export const PLUGIN_CATALOG = [
  {
    key: 'time-tracking',
    name: 'Time tracking',
    category: 'addon',
    description:
      'Start and stop your own task timer. Your recorded time stays available when disabled.',
    permissions: [
      'Record your own task time',
      'Read your own time on accessible boards',
    ],
  },
  {
    key: 'task-voting',
    name: 'Task voting',
    category: 'addon',
    description: 'Vote once per task to help your team choose what matters.',
    permissions: [
      'Read vote totals on accessible boards',
      'Add or remove your own vote',
    ],
  },
  {
    key: 'github',
    name: 'GitHub',
    category: 'integration',
    description:
      'Browse public repositories and open issues. No code changes or private-repository access requested.',
    permissions: ['Read public repositories and issues'],
    setupKeys: ['PLUGIN_GITHUB_CLIENT_ID', 'PLUGIN_GITHUB_CLIENT_SECRET'],
  },
  {
    key: 'slack',
    name: 'Slack',
    category: 'integration',
    description:
      'List public channels and send a message you write. Invite the bot to a channel before sending.',
    permissions: [
      'List public channels (channels:read)',
      'Send a message as the bot (chat:write)',
    ],
    setupKeys: ['PLUGIN_SLACK_CLIENT_ID', 'PLUGIN_SLACK_CLIENT_SECRET'],
  },
  {
    key: 'google-calendar',
    name: 'Google Calendar',
    category: 'integration',
    description:
      'Read upcoming events from your primary calendar. Does not change or sync events.',
    permissions: ['Read calendar events (calendar.events.readonly)'],
    setupKeys: ['PLUGIN_GOOGLE_CLIENT_ID', 'PLUGIN_GOOGLE_CLIENT_SECRET'],
  },
  {
    key: 'custom-extensions',
    name: 'Custom extensions',
    category: 'custom',
    description:
      'Developer-built extensions with declared permissions and isolated execution.',
    permissions: [],
    comingSoon: true,
  },
] as const;

export type Provider = 'github' | 'slack' | 'google-calendar';
export const GITHUB_REPOSITORY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.{1,2}$)[\w.-]{1,100}$/;
export const isProvider = (key: string): key is Provider =>
  ['github', 'slack', 'google-calendar'].includes(key);
