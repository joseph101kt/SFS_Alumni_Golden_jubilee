import Link from 'next/link';

const lanes: { href: string; title: string; body: string; icon: string }[] = [
  {
    href: '/events',
    title: 'Events',
    body: 'Reunions and school celebrations open for registration.',
    icon: 'event',
  },
  {
    href: '/memories',
    title: 'Memories',
    body: 'Browse published photos from your batch and all SFS.',
    icon: 'photo_library',
  },
  {
    href: '/member/donate',
    title: 'Donate',
    body: 'Support a cause — jubilee, students, or the association.',
    icon: 'volunteer_activism',
  },
];

export default function HomeDestinationLanes() {
  return (
    <section className="mt-8 space-y-3" aria-label="Explore the portal">
      {lanes.map((lane) => (
        <Link
          key={lane.href}
          href={lane.href}
          className="group flex items-center gap-4 sm:gap-5 rounded-2xl border border-outline-variant bg-surface-paper px-5 py-5 sm:px-6 transition-transform duration-200 hover:-translate-y-0.5 hover:border-jubilee-gold-deep/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-3xl text-jubilee-gold-deep shrink-0">
            {lane.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-headline-sm text-primary group-hover:underline group-hover:decoration-jubilee-gold-deep group-hover:underline-offset-4">
              {lane.title}
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">{lane.body}</p>
          </div>
          <span className="text-label-md text-primary font-bold shrink-0">{lane.title} ↗</span>
        </Link>
      ))}
    </section>
  );
}
