import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envValidationSchema } from './env.validation';
import appConfig from './loaders/app.config';
import databaseConfig from './loaders/database.config';
import redisConfig from './loaders/redis.config';

/**
 * Global config module.
 *
 * - Loads .env (or .env.<NODE_ENV>) without dotenv-cli — ConfigModule handles it.
 * - Validates every known env var via the Joi schema; failing fast at boot is preferable
 *   to `undefined`-related runtime errors hours later.
 * - Exposes namespaced config via `configService.get('app.port')` etc.
 *
 * Never read `process.env.FOO` directly in application code — go through ConfigService.
 */
@Global()
@Module({
	imports: [
		NestConfigModule.forRoot({
			isGlobal: true,
			cache: true,
			load: [appConfig, databaseConfig, redisConfig],
			validationSchema: envValidationSchema,
			validationOptions: {
				allowUnknown: true,
				abortEarly: false,
			},
		}),
	],
})
export class ConfigModule {}
