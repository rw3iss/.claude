import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  TextChannel,
  type Message,
  type PartialMessage,
} from "discord.js";
import { writeFileSync } from "node:fs";
import { fetch } from "undici";

export interface ConnectedClient {
  client: Client;
  channel: TextChannel;
  close: () => Promise<void>;
}

export async function connect(token: string, channelId: string): Promise<ConnectedClient> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  await new Promise<void>((res, rej) => {
    client.once(Events.ClientReady, () => res());
    client.once(Events.Error, rej);
    client.login(token).catch(rej);
  });

  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !(channel instanceof TextChannel)) {
    await client.destroy();
    throw new Error(`channel ${channelId} is not a text channel or is not accessible`);
  }

  return {
    client,
    channel,
    close: async () => { await client.destroy(); },
  };
}

export type MessageMatcher = (msg: Message) => boolean;

/**
 * Resolve when any new or edited message in `channel` satisfies `matcher`.
 * Listens to BOTH MessageCreate and MessageUpdate — Midjourney often posts
 * a "Waiting to start…" message first and edits it as progress advances,
 * so the final image only shows up via an update event. Partial messages
 * are fetched in full before matching.
 */
export async function waitForMessage(
  channel: TextChannel,
  matcher: MessageMatcher,
  timeoutMs: number
): Promise<Message> {
  return new Promise((res, rej) => {
    let resolved = false;
    let timer: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      channel.client.off(Events.MessageCreate, onCreate);
      channel.client.off(Events.MessageUpdate, onUpdate);
    };

    const tryResolve = (msg: Message) => {
      if (resolved) return;
      if (msg.channelId !== channel.id) return;
      if (!matcher(msg)) return;
      cleanup();
      res(msg);
    };

    const onCreate = (msg: Message) => tryResolve(msg);

    const onUpdate = (
      _old: Message | PartialMessage,
      next: Message | PartialMessage
    ) => {
      if (resolved) return;
      if (!next.channelId || next.channelId !== channel.id) return;
      if (next.partial) {
        next
          .fetch()
          .then((full) => tryResolve(full))
          .catch(() => {
            /* ignore; keep listening */
          });
        return;
      }
      tryResolve(next as Message);
    };

    timer = setTimeout(() => {
      cleanup();
      rej(new Error(`timeout after ${timeoutMs}ms waiting for matching message`));
    }, timeoutMs);

    channel.client.on(Events.MessageCreate, onCreate);
    channel.client.on(Events.MessageUpdate, onUpdate);
  });
}

export async function downloadAttachment(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
}
