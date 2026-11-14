# Tasks typography

The Tasks app uses a compact interface scale defined in `app/globals.css`.
It applies to both instances. Shared UI inherits this scale inside Tasks;
the public sites retain their own defaults. Keep browser and text zoom enabled.

| Role | Utility | Size / line height | Use |
| --- | --- | --- | --- |
| Page title | `text-page-title` | 20/28px; 28/34px from `sm` | `PageHeader` |
| Section title | `text-section-title` | 16/24px | Form sections and dashboard panels |
| Card title | `text-card-title font-semibold` | 13/18px | Tasks, notes, projects, and resource cards |
| Interface / body | `text-body` or `text-sm` | 13/20px | Fields, menus, buttons, navigation, short body copy |
| Supporting copy | `text-secondary` | 12/18px | Descriptions, summaries, helper copy |
| Field label | Shared field components | 12/16px | Labels and legends |
| Metadata | `text-meta` | 11/16px | Counts, dates, authorship, uppercase labels |
| Reading text | `text-base` | 14/22px | Longer detail content |

Existing `text-lg` through `text-4xl` map to 16, 18, 20, 24, and 28px.
Use the named roles for new interface work. Dense task keys and badges may keep
their existing 10px treatment; do not use tiny badges as the body-text default.

Card titles, field values, and labels keep their size across breakpoints.
Use space, weight, and layout to establish hierarchy before increasing text.
Keep placeholder and entered text the same size. Shared fields use the app's
label and control line-height variables, with unchanged fallbacks elsewhere.
