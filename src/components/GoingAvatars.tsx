type Person = {
  user_id: string;
  display_name: string;
  avatar_color: string;
};

const MAX_VISIBLE = 4;

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function GoingAvatars({
  going,
  currentUserId,
  groupName,
  hasActiveGroup,
}: {
  going: Person[];
  currentUserId: string;
  groupName: string | null;
  hasActiveGroup: boolean;
}) {
  if (!hasActiveGroup) {
    return (
      <p className="text-sm text-zinc-600">
        Join a group to see who else is going.
      </p>
    );
  }

  if (going.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        No one from your group yet — be the first.
      </p>
    );
  }

  const iAmGoing = going.some((p) => p.user_id === currentUserId);
  const group = groupName ?? "your group";

  let label: string;
  if (going.length === 1) {
    label = iAmGoing ? "You're going" : `${going[0].display_name} is going`;
  } else if (iAmGoing) {
    const count = going.length - 1;
    label = `You + ${count} other${count > 1 ? "s" : ""} from ${group} going`;
  } else {
    const [first, ...rest] = going;
    label = `${first.display_name} + ${rest.length} other${rest.length > 1 ? "s" : ""} from ${group} going`;
  }

  const visible = going.slice(0, MAX_VISIBLE);
  const overflow = going.length - visible.length;

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-2">
        {visible.map((person) => (
          <div
            key={person.user_id}
            title={person.display_name}
            aria-label={person.display_name}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-sm"
            style={{ backgroundColor: person.avatar_color }}
          >
            {initial(person.display_name)}
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-xs font-semibold text-zinc-600 shadow-sm">
            +{overflow}
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-zinc-700">{label}</p>
    </div>
  );
}
