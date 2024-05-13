import { Link } from "@remix-run/react"

export default function Index() {
  return (
    <main className="max-w-3xl mx-auto space-y-2 h-screen">
      <ul className="space-x-2 h-full flex items-center">
        <Link
          className="p-4 bg-blue-100 w-full border-2 text-blue-900 border-blue-900 hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-100 disabled:text-blue-300 disabled:border-blue-300 col-span-4"
          to="single-player"
        >
          Single player
        </Link>
        <Link
          className="p-4 bg-red-100 w-full border-2 text-red-900 border-red-900 hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-100 disabled:text-red-300 disabled:border-red-300 col-span-4"
          to="multi-player"
        >
          Multiplayer player
        </Link>
        <Link
          className="p-4 bg-green-100 w-full border-2 text-green-900 border-green-900 hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-green-100 disabled:text-green-300 disabled:border-green-300 col-span-4"
          to="peer-player"
        >
          Peer player
        </Link>
      </ul>
    </main>
  )
}
