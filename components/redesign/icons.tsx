// Redesign v1 — inline stroke icons (~2.2 stroke width, semantic accent color via currentColor)
import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function base(props: IconProps) {
  const { size = 24, strokeWidth = 2.2, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };
}

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

export const TrainIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" />
  </svg>
);

export const SparkleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3c.3 3.5 2.2 5.4 5.7 5.7-3.5.3-5.4 2.2-5.7 5.7-.3-3.5-2.2-5.4-5.7-5.7C9.8 8.4 11.7 6.5 12 3Z" />
    <path d="M18.5 14.5c.15 1.6 1 2.45 2.5 2.6-1.5.15-2.35 1-2.5 2.5-.15-1.5-1-2.35-2.5-2.5 1.5-.15 2.35-1 2.5-2.6Z" />
  </svg>
);

export const DropletIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5s6 6.1 6 10.2A6 6 0 0 1 6 13.7C6 9.6 12 3.5 12 3.5Z" />
  </svg>
);

export const LibraryIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="7" height="16" rx="1.4" />
    <rect x="13" y="4" width="7" height="16" rx="1.4" />
    <path d="M7.5 8h0M16.5 8h0" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 2.6, ...p })}>
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PlayIcon = (p: IconProps) => (
  <svg {...base({ ...p })} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const SpinIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 3v4h-4" />
  </svg>
);

export const BookmarkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 4h12v16l-6-4-6 4V4Z" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const MinusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const BarcodeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 7v10M10.5 7v10M14 7v10M17 7v10" />
  </svg>
);
