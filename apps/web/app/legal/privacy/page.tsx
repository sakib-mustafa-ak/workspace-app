import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Workspace OS collects, uses, and stores the personal data you share when you use the Service.',
  robots: { index: true, follow: true },
};

const sections = [
  {
    title: '1. What we collect',
    body: (
      <>
        When you create an account we collect your name and email address, and we store a
        secure, hashed version of your password. As you use the Service we store the content
        you and your teammates add to workspaces — boards, tasks, comments, uploaded files, and
        related activity — along with basic account and workspace records such as roles and
        membership.
      </>
    ),
  },
  {
    title: '2. How we use it',
    body: (
      <>
        We use this information to run the Service: to authenticate you, to store and share the
        content you work on with the teammates you grant access to, to send transactional email
        such as verification and password-reset messages, to process payments for paid features,
        and to keep the Service secure and functioning.
      </>
    ),
  },
  {
    title: '3. Services we rely on',
    body: (
      <>
        Workspace OS relies on a small number of partners to deliver the Service. Email is sent
        through Resend. Payments are processed through Stripe, and your use of Stripe is governed
        by Stripe’s privacy policy. Files you upload are stored with the storage provider that
        your deployment is configured to use. These partners process data on our behalf and only
        for the purpose of providing these services.
      </>
    ),
  },
  {
    title: '4. Access to your data',
    body: (
      <>
        Your workspace content is visible to the people you add to that workspace, based on the
        roles you assign. It is not shared outside your workspace. We don’t sell your personal
        data.
      </>
    ),
  },
  {
    title: '5. Your control',
    body: (
      <>
        You can update your account details in your settings, and you can delete a workspace or
        close your account at any time. Removing content from your workspace deletes it from the
        Service, subject to any legal retention obligations that apply.
      </>
    ),
  },
  {
    title: '6. Security',
    body: (
      <>
        We protect your account with hashed passwords and restrict access to your data by
        authorization checks on every request. No method of transmission or storage is
        completely secure, but we take reasonable steps to protect the information we hold.
      </>
    ),
  },
  {
    title: '7. Changes to this policy',
    body: (
      <>
        We may update this policy as the Service changes. We’ll post the new version on this page
        with a revised date. Continued use of the Service after changes are posted means you
        accept the updated policy.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-surface-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <div className="mt-2 text-sm leading-relaxed text-surface-400">{s.body}</div>
          </section>
        ))}
      </div>
      <p className="mt-12 rounded-lg border border-surface-800 bg-surface-900/40 p-4 text-sm text-surface-400">
        This policy is a starting point and should be reviewed by legal counsel before you rely on it,
        particularly around retention periods and the jurisdictions you operate in.
      </p>
    </article>
  );
}
