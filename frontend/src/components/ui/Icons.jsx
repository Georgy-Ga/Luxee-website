/**
 * Набор SVG иконок для использования в проекте
 * Альтернатива lucide-react для базовых иконок
 */

export const Clock = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="10" strokeWidth="2" />
		<path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
	</svg>
);

export const Power = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
	</svg>
);

export const Settings = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
		<circle cx="12" cy="12" r="3" strokeWidth="2" />
	</svg>
);

export const ChevronDown = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
	</svg>
);

export const ChevronUp = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
	</svg>
);

export const ChevronRight = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
	</svg>
);

export const ChevronLeft = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
	</svg>
);

export const Check = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
	</svg>
);

export const X = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
	</svg>
);

export const Plus = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
	</svg>
);

export const Minus = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
	</svg>
);

export const AlertCircle = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="10" strokeWidth="2" />
		<path strokeLinecap="round" strokeWidth="2" d="M12 8v4" />
		<circle cx="12" cy="16" r="1" fill="currentColor" />
	</svg>
);

export const Info = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="10" strokeWidth="2" />
		<path strokeLinecap="round" strokeWidth="2" d="M12 16v-4" />
		<circle cx="12" cy="8" r="1" fill="currentColor" />
	</svg>
);

export const Loader = ({ className = "w-6 h-6" }) => (
	<svg className={`${className} animate-spin`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
	</svg>
);

export const Calendar = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 2v4M8 2v4M3 10h18" />
	</svg>
);

export const User = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
		<circle cx="12" cy="7" r="4" strokeWidth="2" />
	</svg>
);

export const Users = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
		<circle cx="9" cy="7" r="4" strokeWidth="2" />
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
	</svg>
);

export const Mail = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 6l-10 7L2 6" />
	</svg>
);

export const Bell = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
	</svg>
);

export const Search = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<circle cx="11" cy="11" r="8" strokeWidth="2" />
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
	</svg>
);

export const Eye = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
		<circle cx="12" cy="12" r="3" strokeWidth="2" />
	</svg>
);

export const EyeOff = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 1l22 22" />
	</svg>
);

export const Download = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
	</svg>
);

export const Upload = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
	</svg>
);

export const Trash = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
	</svg>
);

export const Edit = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
	</svg>
);

export const Save = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 21v-8H7v8M7 3v5h8" />
	</svg>
);

export const Copy = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
	</svg>
);

export const ExternalLink = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
	</svg>
);

export const Home = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 22V12h6v10" />
	</svg>
);

export const Menu = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
	</svg>
);

export const MoreVertical = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="1" fill="currentColor" />
		<circle cx="12" cy="5" r="1" fill="currentColor" />
		<circle cx="12" cy="19" r="1" fill="currentColor" />
	</svg>
);

export const MoreHorizontal = ({ className = "w-6 h-6" }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="1" fill="currentColor" />
		<circle cx="19" cy="12" r="1" fill="currentColor" />
		<circle cx="5" cy="12" r="1" fill="currentColor" />
	</svg>
);
