import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
	env: process.env.NODE_ENV ?? 'development',
	port: parseInt(process.env.PORT ?? '3000', 10),
	apiPrefix: process.env.API_PREFIX ?? '',
	corsOrigins: process.env.CORS_ORIGINS ?? '*',
	logLevel: process.env.LOG_LEVEL ?? 'log',
}));
