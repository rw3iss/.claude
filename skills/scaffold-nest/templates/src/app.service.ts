import { Injectable } from '@nestjs/common';

// Reads name + version from package.json at module-load time so the info
// endpoint can report the running build without a file-system read per request.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg: { name: string; version: string } = require('../package.json');

@Injectable()
export class AppService {
	/** Returns metadata for the root endpoint. */
	info(): { name: string; version: string } {
		return { name: pkg.name, version: pkg.version };
	}
}
