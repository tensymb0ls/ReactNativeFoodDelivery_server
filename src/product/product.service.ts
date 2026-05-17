import { Injectable } from '@nestjs/common'
import { returnProductObject } from './return-product.oject'
import { PrismaService } from 'src/prisma.service'
import { productDto } from './dto/product.dto'
import generateSlug from 'src/utils/generate-slug'
import { CategoryService } from 'src/category/category.service'

@Injectable()
export class ProductService {
	constructor(
		private prisma: PrismaService,
		private categoryService: CategoryService
	) {}

	// метод для получения всех продуктов \ продуктов по ключевому слову
	async getAll(searchTerm?: string) {
		if (searchTerm) return this.search(searchTerm)

		return this.prisma.product.findMany({
			select: returnProductObject,
			orderBy: {
				createdAT: 'desc'
			}
		})
	}

	// метод для поиска продукта по имени и\или описанию
	async search(searchTerm: string) {
		return this.prisma.product.findMany({
			where: {
				OR: [
					{
						name: {
							contains: searchTerm,
							mode: 'insensitive'
						}
					},
					{
						description: {
							contains: searchTerm,
							mode: 'insensitive'
						}
					}
				]
			},
			select: returnProductObject
		})
	}

	// метод для получения конкретного продукта по slug
	async bySlug(slug: string) {
		const product = await this.prisma.product.findUnique({
			where: {
				slug
			},
			select: returnProductObject
		})

		if (!product) throw new Error('product not found')

		return product
	}

	// метод для получения всех продуктов категории по slug
	async byCategory(categorySlug: string) {
		const products = await this.prisma.product.findMany({
			where: {
				category: {
					slug: categorySlug
				}
			},
			select: returnProductObject
		})

		if (!products) throw new Error('products not found')

		return products
	}

	// CRUD продуктов
	// !CRUD операции на данный момент работают только со стороны сервера, админ-панели нет
	// TODO: создать админ-панель для CRUD операций

	async create() {
		return this.prisma.product.create({
			data: {
				name: '',
				slug: '',
				image: '',
				description: '',
				price: 0
			}
		})
	}

	async update(id: string, dto: productDto) {
		const { name, description, price, categoryId, image } = dto

		await this.categoryService.byId(categoryId)

		return this.prisma.product.update({
			where: {
				id
			},
			data: {
				name,
				description,
				price,
				category: {
					connect: {
						id: categoryId
					}
				},
				image,
				slug: generateSlug(name)
			}
		})
	}

	async delete(id: string) {
		return this.prisma.product.delete({
			where: {
				id
			}
		})
	}
}
