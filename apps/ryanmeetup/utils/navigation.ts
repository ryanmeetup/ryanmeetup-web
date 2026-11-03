const ACTIVE_GROUP_CLASSES =
  "bg-black/15 text-black shadow-sm ring-1 ring-black/10 dark:bg-white/25 dark:text-white dark:ring-white/20";

const COMMUNITY_PATHS = [
  "/events",
  "/events/upcoming",
  "/gallery",
  "/awards",
  "/about",
  "/name-change",
  "/holidays",
  "/rsvp",
  "/chapters",
];

const GET_INVOLVED_PATHS = [
  "/flyers",
  "/contribute",
  "/ryd",
  "/charity",
  "/sponsors",
  "/donate",
];

const matchesPath = (pathname: string, paths: string[]) =>
  paths.some((path) =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path || pathname.startsWith(`${path}/`),
  );

const getRouteMenuActiveClass = (title: string, pathname: string) => {
  if (title === "Community" && matchesPath(pathname, COMMUNITY_PATHS)) {
    return ACTIVE_GROUP_CLASSES;
  }
  if (title === "Get Involved" && matchesPath(pathname, GET_INVOLVED_PATHS)) {
    return ACTIVE_GROUP_CLASSES;
  }
  return "";
};

export { getRouteMenuActiveClass };
