import Link from "next/link";

export default function GroupSwitcher({
  groups,
  activeGroupId,
  month,
}: {
  groups: { id: string; name: string }[];
  activeGroupId: string | null;
  month: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="mb-6 text-sm text-zinc-500">
        You&apos;re not in any groups yet —{" "}
        <Link href="/groups" className="underline">
          create or join one
        </Link>{" "}
        to see who else is going.
      </p>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-500">Group:</span>
      {groups.map((group) => (
        <Link
          key={group.id}
          href={`/calendar?month=${month}&group=${group.id}`}
          className={
            group.id === activeGroupId
              ? "inline-flex min-h-11 items-center rounded-full bg-zinc-900 px-3 font-medium text-white"
              : "inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-3 text-zinc-700 hover:border-zinc-500"
          }
        >
          {group.name}
        </Link>
      ))}
    </div>
  );
}
