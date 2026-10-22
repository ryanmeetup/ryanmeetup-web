const crons = [
  {
    path: "/api/cron/reconcile-task-attachments",
    schedule: "17 3 * * *",
  },
  {
    path: "/api/cron/send-task-digests",
    schedule: "0 * * * *",
  },
  {
    path: "/api/cron/ryd-upload-reminder",
    schedule: "0 * * * *",
  },
];

export const config = {
  crons: process.env.TASKS_DISABLE_VERCEL_CRONS === "true" ? [] : crons,
};
