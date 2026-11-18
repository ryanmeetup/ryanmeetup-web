/**
 * Whether the whole value is one plausible email address. Surrounding
 * whitespace (such as from autofill) is ignored; anything else around the
 * address is not.
 */
const validateEmail = (email: string) => {
  const value = email.trim();
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const isMoreThanTwoWeeksAgo = (dateString: string) => {
  const [month, day, yearValue] = dateString.split("/");
  const year =
    yearValue.length === 2 ? 2000 + Number(yearValue) : Number(yearValue);
  const parsedDate = new Date(year, Number(month) - 1, Number(day));
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  return parsedDate < twoWeeksAgo;
};

export { isMoreThanTwoWeeksAgo, validateEmail };
