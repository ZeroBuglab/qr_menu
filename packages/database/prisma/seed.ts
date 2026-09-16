import dotenv from "dotenv";
import path from "node:path";
import argon2 from "argon2";
import { PrismaClient, RoleName, RestaurantStatus } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const prisma = new PrismaClient();
const demoPassword = process.env.DEMO_PASSWORD ?? "change-me-before-use";

const localized = (name: string, kk: string, en: string, description: string) => ({ nameRu: name, nameKk: kk, nameEn: en, descriptionRu: description, descriptionKk: description, descriptionEn: description });

async function main() {
  const restaurant = await prisma.restaurant.upsert({ where: { slug: "coffee-house" }, update: {}, create: { slug: "coffee-house", name: "Coffee House", status: RestaurantStatus.ACTIVE, description: "Кофейня и кухня с характером", address: "Жарокова, 41 · Алматы", phone: "+7 700 000 00 00", settings: { create: { serviceFeePercent: 0, defaultPrepMinutes: 20, minimumOrderAmount: 1500, languages: ["ru", "kk", "en"] } } } });
  await prisma.restaurantSettings.upsert({ where: { restaurantId: restaurant.id }, update: {}, create: { restaurantId: restaurant.id, languages: ["ru", "kk", "en"] } });
  const roles = await Promise.all((Object.values(RoleName)).map((name) => prisma.role.upsert({ where: { name }, update: {}, create: { name } })));
  const roleMap = new Map(roles.map((role) => [role.name, role.id]));
  const hashed = await argon2.hash(demoPassword);
  for (const [email, displayName, role] of [["admin@demo.local", "Demo admin", RoleName.OWNER], ["kitchen@demo.local", "Demo kitchen", RoleName.KITCHEN], ["waiter@demo.local", "Demo waiter", RoleName.WAITER]] as const) {
    const user = await prisma.user.upsert({ where: { email }, update: { passwordHash: hashed }, create: { email, displayName, passwordHash: hashed } });
    await prisma.employee.upsert({ where: { userId_restaurantId: { userId: user.id, restaurantId: restaurant.id } }, update: { roleId: roleMap.get(role)! }, create: { userId: user.id, restaurantId: restaurant.id, roleId: roleMap.get(role)! } });
  }
  const categoryNames = [["burgers", "Бургеры", "Бургерлер", "Burgers"], ["pizza", "Пицца", "Пицца", "Pizza"], ["salads", "Салаты", "Салаттар", "Salads"], ["mains", "Основные блюда", "Негізгі тағамдар", "Mains"], ["drinks", "Напитки", "Сусындар", "Drinks"], ["desserts", "Десерты", "Десерттер", "Desserts"]] as const;
  const categories = new Map<string, string>();
  for (const [index, [slug, ru, kk, en]] of categoryNames.entries()) { const category = await prisma.category.upsert({ where: { restaurantId_slug: { restaurantId: restaurant.id, slug } }, update: {}, create: { restaurantId: restaurant.id, slug, sortOrder: index, translations: { create: [{ locale: "ru", name: ru }, { locale: "kk", name: kk }, { locale: "en", name: en }] } } }); categories.set(slug, category.id); }
  const menu = [
    ["truffle-burger", "burgers", 4900, true, true, ["Трюфельный бургер", "Трюфельді бургер", "Truffle burger"], "Мраморная говядина, чеддер, трюфельный айоли"],
    ["classic-burger", "burgers", 3900, true, false, ["Классический бургер", "Классикалық бургер", "Classic burger"], "Говядина, салат, томат, фирменный соус"],
    ["chicken-burger", "burgers", 3500, false, false, ["Криспи бургер", "Криспи бургер", "Crispy burger"], "Хрустящая курица, салат, горчичный соус"],
    ["margherita", "pizza", 3600, true, false, ["Маргарита", "Маргарита", "Margherita"], "Томаты, моцарелла, базилик"],
    ["pepperoni", "pizza", 4200, true, false, ["Пепперони", "Пепперони", "Pepperoni"], "Пепперони, моцарелла, томатный соус"],
    ["four-cheese", "pizza", 4500, false, true, ["Четыре сыра", "Төрт ірімшік", "Four cheese"], "Моцарелла, горгонзола, чеддер, пармезан"],
    ["burrata", "salads", 3700, true, true, ["Буррата & томаты", "Буррата және қызанақ", "Burrata & tomatoes"], "Сливочная буррата, печёные томаты, базилик"],
    ["caesar", "salads", 3300, false, false, ["Цезарь с курицей", "Тауық қосылған Цезарь", "Chicken Caesar"], "Романо, пармезан, курица, соус цезарь"],
    ["salmon", "mains", 5600, true, false, ["Лосось мисо", "Мисо қосылған лосось", "Miso salmon"], "Глазированный лосось, рис, эдамаме"],
    ["pasta", "mains", 4600, true, false, ["Паста с креветкой", "Асшаян қосылған паста", "Prawn pasta"], "Лингвини, тигровые креветки, бисque"],
    ["steak", "mains", 6900, true, false, ["Стейк стриплойн", "Стриплойн стейк", "Striploin steak"], "Мраморная говядина, перечный соус"],
    ["ramen", "mains", 4200, false, false, ["Рамен с курицей", "Тауық рамені", "Chicken ramen"], "Куриный бульон, лапша, яйцо, нори"],
    ["matcha", "drinks", 1800, true, true, ["Матча-тоник", "Матча-тоник", "Matcha tonic"], "Цитрусовая матча, тоник, лёд"],
    ["flat-white", "drinks", 1400, true, false, ["Флэт уайт", "Флэт уайт", "Flat white"], "Двойной эспрессо, бархатистое молоко"],
    ["lemonade", "drinks", 1200, false, false, ["Лимонад юдзу", "Юдзу лимонады", "Yuzu lemonade"], "Юдзу, лимон, содовая"],
    ["tiramisu", "desserts", 2100, true, false, ["Тирамису KÖR", "KÖR тирамисуы", "KÖR tiramisu"], "Маскарпоне, эспрессо, какао"],
    ["cheesecake", "desserts", 2300, false, false, ["Чизкейк с ягодами", "Жидек қосылған чизкейк", "Berry cheesecake"], "Сливочный сыр, ваниль, сезонные ягоды"],
    ["pavlova", "desserts", 1900, false, true, ["Павлова", "Павлова", "Pavlova"], "Меренга, сливки, свежие ягоды"],
  ] as const;
  for (const [sort, [slug, category, price, popular, chef, names, description]] of menu.entries()) { const [nameRu, nameKk, nameEn] = names; await prisma.product.upsert({ where: { restaurantId_slug: { restaurantId: restaurant.id, slug } }, update: {}, create: { restaurantId: restaurant.id, categoryId: categories.get(category)!, slug, price, nameRu, nameKk, nameEn, descriptionRu: description, descriptionKk: description, descriptionEn: description, isPopular: popular, isChefChoice: chef, isNew: slug === "burrata" || slug === "matcha", sortOrder: sort, prepMinutes: 12 + (sort % 4) * 3 } }); }
  for (const number of ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]) { const table = await prisma.restaurantTable.upsert({ where: { restaurantId_number: { restaurantId: restaurant.id, number } }, update: {}, create: { restaurantId: restaurant.id, number } }); await prisma.qRCode.upsert({ where: { tokenHash: `demo-table-${number}` }, update: {}, create: { tableId: table.id, tokenHash: `demo-table-${number}`, label: `Table ${number}` } }); }
  console.log(`Seeded ${restaurant.name}. Demo password is supplied via DEMO_PASSWORD and must be changed.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
