import Joi from 'joi';

/**
 * Joi schema for every env var the app reads. Boot fails with a clear error
 * message if anything required is missing or malformed — better than a
 * silent `undefined` at request time.
 */
export const envValidationSchema = Joi.object({
	// App
	NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
	PORT: Joi.number().port().default(3000),
	API_PREFIX: Joi.string().allow('').default(''),
	CORS_ORIGINS: Joi.string().allow('').default('*'),
	LOG_LEVEL: Joi.string().valid('error', 'warn', 'log', 'debug', 'verbose').default('log'),

	// Database
	DB_HOST: Joi.string().required(),
	DB_PORT: Joi.number().port().default(5432),
	DB_USER: Joi.string().required(),
	DB_PASSWORD: Joi.string().allow('').required(),
	DB_NAME: Joi.string().required(),
	DB_SYNCHRONIZE: Joi.boolean().default(false),

	// Redis
	REDIS_HOST: Joi.string().required(),
	REDIS_PORT: Joi.number().port().default(6379),
	REDIS_PASSWORD: Joi.string().allow('').optional(),
	REDIS_DB: Joi.number().min(0).default(0),
});
