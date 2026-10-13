import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { HealthModule } from './health/health.module';

// Root module. Feature modules go under src/modules/ and are imported here
// (keep this import list flat — no transitive module graphs).
@Module({
	imports: [ConfigModule, DatabaseModule, CacheModule, HealthModule],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
