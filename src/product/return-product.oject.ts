import { Prisma } from '@prisma/client'
import { returnCategoryObject } from 'src/category/return-category.object'

export const returnProductObject: Prisma.ProductSelect = {
	id: true,
	name: true,
	description: true,
	price: true,
	createdAT: true,
	slug: true,
	image: true,
	category: { select: returnCategoryObject }
}
