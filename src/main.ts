import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)
	app.setGlobalPrefix('api') // устанавливает по умолчаню префикс :4200/api/
	app.enableCors()
	await app.listen(process.env.PORT ?? 4200)
	console.log(`🚀 Server is running on: http://localhost:4200/api`)
}
bootstrap()
