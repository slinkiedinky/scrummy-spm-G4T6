// "use client"
// import { Sidebar } from "@/components/Sidebar"
// import { useState } from "react"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// import { Badge } from "@/components/ui/badge"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Plus, Search, Mail } from "lucide-react"


// export default function TeamPage() {
//     const [teamMembers] = useState() // team members
//     const [searchTerm, setSearchTerm] = useState("")

//     const filteredMembers = teamMembers.filter(
//         (member) =>
//         member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         member.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         member.email.toLowerCase().includes(searchTerm.toLowerCase())
//     )
    
//   return (
//     <div className="flex h-screen bg-background">
//       <Sidebar />
//       <main className="flex-1 overflow-hidden">
//         <div className="flex flex-col h-full">
//         {/* Header */}
//         <div className="border-b border-border bg-card p-6">
//             <div className="flex items-center justify-between mb-6">
//             <div>
//                 <h1 className="text-3xl font-bold text-foreground">Team Members</h1>
//                 <p className="text-muted-foreground mt-1">Manage your team and their roles</p>
//             </div>
//             <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
//                 <Plus className="h-4 w-4 mr-2" />
//                 Add Member
//             </Button>
//             </div>

//             {/* Search */}
//             <div className="relative max-w-md">
//             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//             <Input
//                 placeholder="Search team members..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className="pl-10"
//             />
//             </div>
//         </div>

//         {/* Team Grid */}
//         <div className="flex-1 overflow-auto p-6">
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
//             {filteredMembers.map((member) => (
//                 <Card key={member.id} className="hover:shadow-lg transition-shadow duration-200">
//                 <CardHeader className="text-center pb-4">
//                     <Avatar className="h-20 w-20 mx-auto mb-4">
//                     <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
//                     <AvatarFallback className="text-lg">
//                         {member.name
//                         .split(" ")
//                         .map((n) => n[0])
//                         .join("")}
//                     </AvatarFallback>
//                     </Avatar>
//                     <CardTitle className="text-lg">{member.name}</CardTitle>
//                     <Badge variant="secondary" className="w-fit mx-auto">
//                     {member.role}
//                     </Badge>
//                 </CardHeader>
//                 <CardContent className="space-y-3">
//                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
//                     <Mail className="h-4 w-4" />
//                     <span className="truncate">{member.email}</span>
//                     </div>
//                     <div className="flex gap-2">
//                     <Button size="sm" variant="outline" className="flex-1 bg-transparent">
//                         Message
//                     </Button>
//                     <Button size="sm" variant="outline" className="flex-1 bg-transparent">
//                         Profile
//                     </Button>
//                     </div>
//                 </CardContent>
//                 </Card>
//             ))}
//             </div>
//         </div>
//         </div>
//       </main>
//     </div>
//   )
// }