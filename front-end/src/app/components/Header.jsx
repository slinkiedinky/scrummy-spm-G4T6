import LogoutButton from "./LogoutButton";

export default function Header({ title, userData }) {
  return (
    <header className="w-full bg-gray-800 shadow-md flex items-center justify-between px-6 py-4 sticky top-0 z-50">
      <h1 className="text-xl font-semibold text-gray-100">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="text-amber-300 text-sm text-right">
          <div>{userData.fullName}</div>
          <div className="text-gray-300 font-bold text-xs">{userData.role}</div>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}