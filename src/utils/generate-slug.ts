// generate-slug.ts
/**
 * Генерация SEO-friendly slug из строки.
 *
 * Поддерживает:
 * - транслитерацию кириллицы -> латиница
 * - удаление диакритики
 * - нормализацию пробелов -> '-'
 * - удаление не-алфавитно-цифровых символов (оставляет '-')
 * - обрезку по длине и удаление дубликатов дефисов
 *
 * Экспортирует две функции:
 *  - generateSlug(text, options) => string
 *  - generateUniqueSlug(text, isUniqueFn, options) => Promise<string>
 */

type Options = {
	lower?: boolean // привести к нижнему регистру (по умолчанию true)
	maxLength?: number // максимальная длина slug (по умолчанию 100)
	fallbackRandom?: boolean // если slug пустой — добавлять случайный суффикс (по умолчанию true)
	randomLength?: number // длина случайного суффикса (по умолчанию 6)
}

const DEFAULTS: Required<Options> = {
	lower: true,
	maxLength: 100,
	fallbackRandom: true,
	randomLength: 6
}

/** Простая карта транслитерации кириллицы -> латиница (расширяемая) */
const CYR_TO_LAT: Record<string, string> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'g',
	д: 'd',
	е: 'e',
	ё: 'yo',
	ж: 'zh',
	з: 'z',
	и: 'i',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'kh',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'shch',
	ъ: '',
	ы: 'y',
	ь: '',
	э: 'e',
	ю: 'yu',
	я: 'ya',
	// Украинские/белорусские и похожие
	є: 'ye',
	ї: 'yi',
	і: 'i',
	ґ: 'g',
	ł: 'l'
}

/** Транслитерировать строку (обрабатывает только символы из карты) */
function transliterate(str: string): string {
	return str
		.split('')
		.map(ch => {
			const lower = ch.toLowerCase()
			if (CYR_TO_LAT[lower]) {
				const mapped = CYR_TO_LAT[lower]
				// сохранить регистр, если нужно (мы обычно приводим к lower позже)
				return mapped
			}
			return ch
		})
		.join('')
}

/** Сгенерировать случайную строку из букв+цифр */
function randomString(len: number) {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
	let out = ''
	for (let i = 0; i < len; i++) {
		out += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
	}
	return out
}

/**
 * Основная синхронная функция генерации slug.
 */
export function generateSlug(input: string, opts?: Options): string {
	const o = { ...DEFAULTS, ...(opts || {}) }

	if (!input || typeof input !== 'string') {
		if (o.fallbackRandom) return randomString(o.randomLength)
		return ''
	}

	// 1) Trim
	let s = input.trim()

	// 2) Transliterate Cyrillic -> Latin
	s = transliterate(s)

	// 3) Remove diacritics (é -> e)
	s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

	// 4) Replace any non-letter/number with hyphen.
	// Allow latin letters and numbers only. Replace underscores/spaces/punct -> '-'
	// Also remove characters outside basic latin after transliteration.
	s = s.replace(/[^A-Za-z0-9]+/g, '-')

	// 5) lower-case if requested
	if (o.lower) s = s.toLowerCase()

	// 6) collapse multiple hyphens -> single, trim hyphens at ends
	s = s.replace(/-+/g, '-').replace(/^-|-$/g, '')

	// 7) enforce max length (try to not cut a word awkwardly: cut and trim trailing hyphen)
	if (s.length > o.maxLength) {
		s = s.slice(0, o.maxLength)
		s = s.replace(/-+$/g, '')
	}

	// 8) fallback if empty
	if (!s) {
		if (o.fallbackRandom) return randomString(o.randomLength)
		return ''
	}

	return s
}

/**
 * Асинхронная функция, которая пытается гарантировать уникальность slug,
 * используя callback isUniqueFn(slug) => Promise<boolean>.
 *
 * Алгоритм:
 *  - берём базовый slug
 *  - если уникален -> возвращаем
 *  - иначе добавляем суффикс `-1`, `-2`, ... пока не найдём свободный (макс 1000 попыток),
 *    при достижении maxAttempts добавляет случайный суффикс.
 */
export async function generateUniqueSlug(
	input: string,
	isUniqueFn: (slug: string) => Promise<boolean>,
	opts?: Options & { maxAttempts?: number }
): Promise<string> {
	const o = {
		...DEFAULTS,
		...(opts || {}),
		maxAttempts: (opts as any)?.maxAttempts ?? 1000
	}
	const base = generateSlug(input, o)
	if (!base) {
		// если base пустой, используем random и проверяем
		let attempt = 0
		while (attempt < o.maxAttempts) {
			const candidate = `${randomString(o.randomLength)}`
			if (await isUniqueFn(candidate)) return candidate
			attempt++
		}
		// fallback
		return `${base}-${randomString(o.randomLength)}`
	}

	if (await isUniqueFn(base)) return base

	// пробуем с числовым суффиксом
	for (let i = 1; i <= (o as any).maxAttempts; i++) {
		const suffix = `-${i}`
		let candidate = base
		// учитываем maxLength: если длина превысит, обрежем базу
		const maxLen = o.maxLength
		if (candidate.length + suffix.length > maxLen) {
			candidate = candidate.slice(0, maxLen - suffix.length).replace(/-+$/g, '')
		}
		candidate = `${candidate}${suffix}`
		if (await isUniqueFn(candidate)) return candidate
	}

	// крайний случай — добавляем случайный суффикс
	for (let i = 0; i < 10; i++) {
		const cand = `${base}-${randomString(o.randomLength)}`
		if (await isUniqueFn(cand)) return cand
	}

	// если всё сломалось — вернуть базу + random (без гарантии)
	return `${base}-${randomString(o.randomLength)}`
}

/* ========== Примеры использования ==========

Простой:
import { generateSlug } from './generate-slug'
console.log(generateSlug('Привет мир! Это — тест.')) // -> 'privet-mir-eto-test'

С проверкой уникальности (например, проверка в БД):
import { generateUniqueSlug } from './generate-slug'
const isUnique = async (slug: string) => {
  // await prisma.post.findUnique({ where: { slug } }) => null ? true : false
}
const unique = await generateUniqueSlug('Заголовок статьи', isUnique)
console.log(unique) // 'zagolovok-stati', или 'zagolovok-stati-1' и т.д.

======================================== */

export default generateSlug
