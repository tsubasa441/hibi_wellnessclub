type Props = {
  level: number;
  size?: number;
  className?: string;
};

export default function RankIcon({ level, size = 18, className = "" }: Props) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (level) {
    case 1: // Seed
      return (
        <svg {...props}>
          <ellipse cx="12" cy="14" rx="5" ry="6" />
          <path d="M12 8 C12 5 14 3 16 3" />
          <path d="M12 8 C12 5 10 3 8 3" />
        </svg>
      );
    case 2: // Sprout
      return (
        <svg {...props}>
          <path d="M12 21 L12 15" />
          <path d="M12 15 C11 12 7 11 7 14 C7 17 11 17 12 15" />
          <path d="M12 15 C13 12 17 11 17 14 C17 17 13 17 12 15" />
        </svg>
      );
    case 3: // Sapling
      return (
        <svg {...props}>
          <path d="M12 21 L12 13" />
          <path d="M12 13 L8 9" />
          <path d="M12 13 L12 8" />
          <path d="M12 13 L16 9" />
          <circle cx="8" cy="7" r="2.2" />
          <circle cx="12" cy="6" r="2.2" />
          <circle cx="16" cy="7" r="2.2" />
        </svg>
      );
    case 4: // Leaf
      return (
        <svg {...props}>
          <path d="M6 20 C6 20 12 18 16 14 C20 10 21 4 21 4 C21 4 15 5 11 9 C7 13 6 20 6 20Z" />
          <path d="M6 20 L12 14" />
        </svg>
      );
    case 5: // Bud
      return (
        <svg {...props}>
          <path d="M12 21 L12 13" />
          <path d="M12 13 C12 13 8 12 8 8 C8 5 10 4 12 4 C14 4 16 5 16 8 C16 12 12 13 12 13Z" />
          <path d="M9 17 C9 17 7 16 7 14" />
          <path d="M15 17 C15 17 17 16 17 14" />
        </svg>
      );
    case 6: // Bloom
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2.5" />
          <ellipse cx="12" cy="5.5" rx="2" ry="3" />
          <ellipse cx="18.2" cy="9.5" rx="2" ry="3" transform="rotate(72 18.2 9.5)" />
          <ellipse cx="15.8" cy="17" rx="2" ry="3" transform="rotate(144 15.8 17)" />
          <ellipse cx="8.2" cy="17" rx="2" ry="3" transform="rotate(-144 8.2 17)" />
          <ellipse cx="5.8" cy="9.5" rx="2" ry="3" transform="rotate(-72 5.8 9.5)" />
        </svg>
      );
    case 7: // Fruit
      return (
        <svg {...props}>
          <circle cx="12" cy="14" r="6" />
          <path d="M12 8 C12 8 12 5 14 4" />
          <path d="M12 8 C12 6 10 5 9 5" />
        </svg>
      );
    case 8: // Ancient Tree
      return (
        <svg {...props}>
          <path d="M11 21 L13 21 L13 13 L11 13 Z" />
          <path d="M8 21 L16 21" />
          <path d="M2 13 C2 6 6 3 12 3 C18 3 22 6 22 13 Z" />
          <path d="M6 13 C6 9 9 7 12 7 C15 7 18 9 18 13" />
        </svg>
      );
    default:
      return null;
  }
}
