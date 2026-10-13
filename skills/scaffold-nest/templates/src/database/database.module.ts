import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Wires TypeORM to Postgres using the validated config namespace.
 *
 * Entities are auto-loaded via `autoLoadEntities: true` — each feature module
 * registers its entity with `TypeOrmModule.forFeature([Entity])` and this
 * module picks it up.
 *
 * Migrations live in `src/database/migrations/`. Never enable `synchronize`
 * outside development; use migrations for schema changes.
 */
@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				type: 'postgres' as const,
				host: config.get<string>('database.host'),
				port: config.get<number>('database.port'),
				username: config.get<string>('database.username'),
				password: config.get<string>('database.password'),
				database: config.get<string>('database.database'),
				autoLoadEntities: true,
				synchronize: config.get<boolean>('database.synchronize') ?? false,
				migrations: [__dirname + '/migrations/*.{ts,js}'],
				logging: config.get<string>('app.env') === 'development' ? ['error', 'warn'] : ['error'],
			}),
		}),
	],
})
export class DatabaseModule {}
