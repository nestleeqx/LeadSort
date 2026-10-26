/**
 * Тестовые заявки для кнопки «Отправить тестовую заявку» на сайте студии.
 *
 * Имя, город, бюджет и телефон каждый раз разные: одинаковый текст нейросеть второй раз
 * не разбирает (он берётся из кеша), а на демо важно показать настоящий разбор.
 * Люди, компании и номера вымышлены.
 */

export type TestLead = { name: string; contact: string; message: string };

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

const NAMES = ["Анна", "Ольга", "Мария", "Елена", "Игорь", "Дмитрий", "Сергей", "Алексей", "Наталья", "Павел"];
const CITIES = ["Казани", "Самаре", "Екатеринбурге", "Новосибирске", "Краснодаре", "Перми", "Воронеже"];
const MONTHS = ["весне", "лету", "1 марта", "концу квартала", "Новому году"];

function phone() {
  const code = pick(["912", "916", "921", "926", "950", "977", "999"]);
  const rest = digits(7);
  return Math.random() < 0.5
    ? `+7 ${code} ${rest.slice(0, 3)}-${rest.slice(3, 5)}-${rest.slice(5)}`
    : `8${code}${rest}`;
}

const TEMPLATES: (() => TestLead)[] = [
  () => ({
    name: pick(NAMES),
    contact: phone(),
    message:
      "Здравствуйте! У нас перестала работать форма заказа на сайте — после отправки ничего не происходит, " +
      `заявки не приходят. Сегодня запускаем рекламу, помогите срочно! Сайт делали ${pick(["три", "два", "четыре"])} года назад.`,
  }),
  () => ({
    name: pick(NAMES),
    contact: phone(),
    message:
      `Добрый день. Открываем стоматологию в ${pick(CITIES)}, нужен сайт с услугами, ценами и онлайн-записью. ` +
      `Бюджет около ${pick([120, 150, 180, 200])} тыс., хотим запуститься к ${pick(MONTHS)}.`,
  }),
  () => ({
    name: pick(NAMES),
    contact: `@${pick(["remont", "stroy", "dom", "master"])}_${pick(["pro", "plus", "city"])}${digits(2)}`,
    message:
      "Хотим добавить на наш сайт на WordPress калькулятор стоимости ремонта и подключить заявки в Битрикс24. " +
      "Сколько это будет стоить и сколько займёт по времени?",
  }),
  () => ({
    name: pick(NAMES),
    contact: phone(),
    message: `Подскажите, делаете ли вы сайты на Tilda? И сколько стоит поддержка в месяц, если сайтов ${pick(["два", "три"])}?`,
  }),
  () => ({
    name: pick(NAMES),
    contact: `shop${digits(3)}@${pick(["mail.ru", "yandex.ru", "gmail.com"])}`,
    message:
      `Нужен интернет-магазин детской одежды: каталог, фильтры, оплата картой, доставка СДЭК. Около ${pick([300, 500, 800])} ` +
      `товаров, выгрузка из МойСклад. Бюджет до ${pick([350, 400, 500])} тыс., к ${pick(MONTHS)}.`,
  }),
  () => ({
    name: "",
    contact: `partner${digits(2)}@seo-${pick(["top", "boost", "rocket"])}.example`,
    message:
      "Предлагаем размещение ссылок на трастовых сайтах и продвижение в ТОП-3 Яндекса. " +
      `Скидка ${pick([30, 50, 70])}% до конца недели! Гарантия результата.`,
  }),
  () => ({
    name: pick(NAMES),
    contact: phone(),
    message:
      `Добрый день, у нас через ${pick([5, 7, 10])} дней заканчивается SSL-сертификат, а прежний разработчик не отвечает. ` +
      "Можете продлить и заодно взять сайт на обслуживание?",
  }),
  () => ({ name: pick(NAMES), contact: phone(), message: "" }),
];

let last = -1;

/** Случайная тестовая заявка, не повторяющая предыдущую по шаблону. */
export function randomTestLead(): TestLead {
  let index = Math.floor(Math.random() * TEMPLATES.length);
  if (index === last) index = (index + 1) % TEMPLATES.length;
  last = index;
  return TEMPLATES[index]();
}
