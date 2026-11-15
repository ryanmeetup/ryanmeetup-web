# Tasks typography

The Tasks app uses a compact interface scale defined in `app/globals.css`.
It applies to both instances. Shared UI inherits this scale inside Tasks;
the public sites retain their own defaults. Keep browser and text zoom enabled.

| Role | Utility | Size / line height | Use |
| --- | --- | --- | --- |
| Page title | `text-page-title` | 20/28px; 28/34px from `sm` | `PageHeader` |
| Section title | `text-section-title` | 16/24px | Form sections and dashboard panels |
| Task title | `text-task-title font-semibold` | 15/20px | Task board cards and list rows |
| Card title | `text-card-title font-semibold` | 13/18px | Notes, projects, and resource cards |
| Interface / body | `text-body` or `text-sm` | 13/20px | Fields, placeholders, page and section descriptions, card summaries, menus, buttons, navigation |
| Secondary detail | `text-secondary` | 12/18px | Short field hints and secondary authorship |
| Field label | Shared field components | 12/16px | Labels and legends |
| Metadata | `text-meta` | 11/16px | Counts, dates, authorship, uppercase labels |
| Reading text | `text-base` | 14/22px | Longer detail content |

Existing `text-lg` through `text-4xl` map to 16, 18, 20, 24, and 28px.
Use the named roles for new interface work. Dense task keys and badges may keep
their existing 10px treatment; do not use tiny badges as the body-text default.

Card titles, field values, and labels keep their size across breakpoints.
Use space, weight, and layout to establish hierarchy before increasing text.
Keep page descriptions, explanatory copy, placeholders, and entered text the same
size. Reserve the smaller secondary role for brief hints and secondary details.
Shared fields use the app's label and control line-height variables, with
unchanged fallbacks elsewhere.
