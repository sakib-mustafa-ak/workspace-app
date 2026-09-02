import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern the use of the Workspace OS collaborative workspace platform.',
  robots: { index: true, follow: true },
};

const sections = [
  {
    title: '1. What this covers',
    body: (
      <>
        These terms govern your use of Workspace OS (the “Service”), a collaborative
        workspace platform that hosts shared boards, tasks, files, and related team data.
        By creating an account or using the Service, you agree to these terms. If you use
        the Service on behalf of an organization, you agree on that organization’s behalf.
      </>
    ),
  },
  {
    title: '2. Your account',
    body: (
      <>
        You’re responsible for keeping your account credentials confidential and for
        activity that happens under your account. You must provide accurate information
        when you sign up. You may not use the Service to violate the law or anyone else’s
        rights.
      </>
    ),
  },
  {
    title: '3. Your content',
    body: (
      <>
        You keep ownership of the content you add to your workspaces. You grant us the
        limited permission needed to operate the Service — for example, to store that
        content, display it to the people you share a workspace with, and transmit it
        between your device and our servers. You’re responsible for the content you and
        your teammates add and for making sure you have the right to share it.
      </>
    ),
  },
  {
    title: '4. Workspaces, roles, and access',
    body: (
      <>
        Workspaces are shared spaces with owners and members. Owners and admins control
        who can join and what roles members hold. You’re responsible for the access you
        grant inside your workspaces, including invitations and role assignments.
      </>
    ),
  },
  {
    title: '5. Payments and billing',
    body: (
      <>
        Paid features are billed as a subscription and processed by Stripe. Your use of
        Stripe’s payment services is also governed by Stripe’s own terms of service and
        privacy policy. If you cancel, access to paid features ends at the end of the
        current billing period. Unpaid or overdue invoices may result in limited access to
        paid features.
      </>
    ),
  },
  {
    title: '6. Acceptable use',
    body: (
      <>
        Don’t use the Service to store or share unlawful content, to probe or disrupt the
        Service or other users, to send spam, or to attempt to access accounts or systems
        you don’t own. We may remove content or suspend accounts that violate these terms.
      </>
    ),
  },
  {
    title: '7. Termination',
    body: (
      <>
        You can delete a workspace or close your account at any time. We may suspend or
        terminate access if you breach these terms. When you delete data, it’s removed from
        the Service, subject to any legal retention requirements that apply to us.
      </>
    ),
  },
  {
    title: '8. Intellectual property',
    body: (
      <>
        The Service itself — its software, design, and brand — is owned by us and protected
        by intellectual property law. This agreement doesn’t give you any rights to the
        Service other than the right to use it.
      </>
    ),
  },
  {
    title: '9. Disclaimer and limitation of liability',
    body: (
      <>
        The Service is provided “as is” without any express or implied warranties. To the
        fullest extent permitted by law, we aren’t liable for indirect, incidental, or
        consequential damages arising from your use of the Service. Nothing in these terms
        limits liability that cannot be limited by law.
      </>
    ),
  },
  {
    title: '10. Changes to these terms',
    body: (
      <>
        We may update these terms as the Service evolves. When we do, we’ll post the new
        version here with a revised date. Continued use of the Service after changes are
        posted means you accept the updated terms.
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
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
        These terms are a starting point and should be reviewed by legal counsel before you
        rely on them. This page is hosted for your product and is not a substitute for
        professional legal advice.
      </p>
    </article>
  );
}
