import { getTagIcon, type TagIconId } from "./tag-icons.js";

type TagIconProps = {
  id: TagIconId | string;
  size?: number;
  className?: string;
};

export function TagIcon({ id, size = 12, className }: TagIconProps) {
  const Icon = getTagIcon(id);
  const props: { size?: number; className?: string } = { size };
  if (className !== undefined) {
    props.className = className;
  }
  // eslint-disable-next-line react-hooks/static-components -- Icon is dynamic by design
  return <Icon {...props} />;
}
