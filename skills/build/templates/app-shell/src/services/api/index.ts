import type { ApiClient } from "./ApiClient";
import { MockApiAdapter } from "../../mock/MockApiAdapter";

// Swap this one line for a real HTTP adapter to integrate with a backend:
//   export const apiClient: ApiClient = new HttpApiAdapter(baseUrl, authToken);
export const apiClient: ApiClient = new MockApiAdapter();
