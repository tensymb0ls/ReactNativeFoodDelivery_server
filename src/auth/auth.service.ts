import {
	BadRequestException,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { AuthDto } from './dto/auth.dto'
import { faker } from '@faker-js/faker'
import { hash, verify } from 'argon2'
import { JwtService } from '@nestjs/jwt'
import { User } from 'generated/prisma'

@Injectable()
export class AuthService {
	constructor(
		private prisma: PrismaService,
		private jwt: JwtService
	) {}

	// метод логина пользователей
	async login(dto: AuthDto) {
		const user = await this.validateUser(dto)
		const tokens = await this.issueTokens(user.id)

		return {
			user: this.returnUserFields(user),
			...tokens
		}
	}

	// метод получения новых токенов
	async getNewTokens(refreshToken: string) {
		const result = await this.jwt.verifyAsync(refreshToken)
		if (!result) throw new UnauthorizedException('Invalid refresh token') // если в ответе проблема с токеном - выводим ошибку

		const user = await this.prisma.user.findUnique({
			where: {
				id: result.id
			}
		})
		if (!user) throw new UnauthorizedException('User not found')
		const tokens = await this.issueTokens(user.id)

		return {
			user: this.returnUserFields(user),
			...tokens
		}
	}

	// регистрация юзера
	async register(dto: AuthDto) {
		// проверка наличия юзера в бд
		const oldUser = await this.prisma.user.findUnique({
			// ищем введенный юзером email в бд
			where: {
				email: dto.email
			}
		})

		// если такой email существует, выводим ответ с описанием ошибки
		if (oldUser)
			throw new BadRequestException(
				'User with this email or name already exists'
			)

		// создаем нового юзера
		const user = await this.prisma.user.create({
			data: {
				email: dto.email,
				name: faker.name.firstName(),
				avatarPath: faker.image.avatar(),
				phone: faker.phone.number(),
				password: await hash(dto.password)
			}
		})

		const tokens = await this.issueTokens(user.id)

		return {
			user: this.returnUserFields(user),
			...tokens
		}
	}
	// token's lifecycle
	private async issueTokens(userId: string) {
		const data = { id: userId }

		const accessToken = this.jwt.sign(data, {
			expiresIn: '1h'
		})
		const refreshToken = this.jwt.sign(data, {
			expiresIn: '7d'
		})
		return { accessToken, refreshToken }
	}

	private returnUserFields(user: User) {
		return {
			id: user.id,
			email: user.email
		}
	}
	// метод проверки юзера (при логине например)
	private async validateUser(dto: AuthDto) {
		// ищем юзера с указанным email в бд
		const user = await this.prisma.user.findUnique({
			where: {
				email: dto.email
			}
		})
		if (!user) throw new NotFoundException('validateUser error: User not found') // если юзера нет в бд - выводим ошибку

		// проверка на валидность пароля
		const isValid = await verify(user.password, dto.password)

		if (!isValid)
			throw new UnauthorizedException('validateUser error:  Invalid password') // если пароль неверный - выводим ошибку

		return user
	}
}
