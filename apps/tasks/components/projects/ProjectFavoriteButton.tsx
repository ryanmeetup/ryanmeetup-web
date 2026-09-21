import { IconButton } from "@ryanmeetup/ui";
import { FiStar } from "react-icons/fi";

export function ProjectFavoriteButton({
  favorite,
  pending,
  projectName,
  size = "sm",
  onToggle,
}: {
  favorite: boolean;
  pending: boolean;
  projectName: string;
  size?: "sm" | "md";
  onToggle: () => void;
}) {
  return (
    <IconButton
      label={`${favorite ? "Remove" : "Add"} “${projectName}” ${favorite ? "from" : "to"} favorites`}
      variant="plain"
      size={size}
      disabled={pending}
      onClick={onToggle}
      className={`align-middle ${
        favorite
          ? "!text-amber-500 dark:!text-amber-300"
          : "!text-black/25 hover:!text-amber-500 dark:!text-white/25 dark:hover:!text-amber-300"
      }`}
    >
      <FiStar size={18} fill={favorite ? "currentColor" : "none"} />
    </IconButton>
  );
}
