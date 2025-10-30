"use client";

import PropTypes from "prop-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  User,
  Users,
  Tag,
  MessageSquare,
  Paperclip,
  Edit,
  Trash2,
  Repeat,
  Star,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  listSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  listComments,
  addComment,
  editComment,
  deleteComment,
  listStandaloneComments,
  addStandaloneComment,
  editStandaloneComment,
  deleteStandaloneComment,
  listSubtaskComments,
  addSubtaskComment,
  editSubtaskComment,
  deleteSubtaskComment,
  createStandaloneSubtask,
  listStandaloneSubtasks,
  updateStandaloneSubtask,
  deleteStandaloneSubtask,
  updateTask,
  updateStandaloneTask,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertCircle } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

function toInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0].includes("@") ? parts[0].split("@")[0] : parts[0])
    .slice(0, 2)
    .toUpperCase();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  if (typeof value === "object" && typeof value.seconds === "number")
    return new Date(value.seconds * 1000);
  return null;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  disableActions = false,
  teamMembers = [],
  currentUserId,
  onSubtaskChange,
  onSubtaskClick,
  scrollToComments = false,
}) {
  const [showSubtaskDialog, setShowSubtaskDialog] = useState(false);
  const [subtaskRefreshKey, setSubtaskRefreshKey] = useState(0);
  const [selectedSubtask, setSelectedSubtask] = useState(null);
  const [userDetails, setUserDetails] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const commentsRef = useRef(null);

  const isSubtask = task.isSubtask || task.parentTaskId;

  // Fetch user details for assignee, creator, and collaborators
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!isOpen || !task) return;

      setLoadingUsers(true);
      const users = {};
      const userIds = new Set();

      // Collect all user IDs
      if (task.assigneeId) userIds.add(task.assigneeId);
      if (task.createdBy) userIds.add(task.createdBy);
      if (task.ownerId) userIds.add(task.ownerId);
      if (Array.isArray(task.collaboratorsIds)) {
        task.collaboratorsIds.forEach((id) => userIds.add(id));
      }
      if (Array.isArray(task.collaboratorIds)) {
        task.collaboratorIds.forEach((id) => userIds.add(id));
      }

      // Fetch user details
      for (const userId of userIds) {
        try {
          const userDoc = await getDoc(doc(db, "users", userId));
          if (userDoc.exists()) {
            users[userId] = userDoc.data();
          }
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
        }
      }

      setUserDetails(users);
      setLoadingUsers(false);
    };

    fetchUserDetails();
  }, [isOpen, task]);

  const getUserInfo = (userId) => {
    if (!userId)
      return { name: "Unassigned", email: "", role: "", initials: "?" };

    const user = userDetails[userId];
    const name =
      user?.fullName ||
      user?.displayName ||
      user?.name ||
      user?.email ||
      `User ${userId.slice(0, 8)}`;
    const email = user?.email || "";
    const role = user?.role || "Member";
    const initials = toInitials(name);

    return {
      name,
      email,
      role,
      initials,
      avatar: user?.photoURL || user?.avatar,
    };
  };

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState("");

  // Mention autocomplete state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionPosition, setMentionPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const commentInputRef = useRef(null);

  // Load comments when modal opens or task changes
  useEffect(() => {
    if (!isOpen || !task?.id) return;
    setLoadingComments(true);
    const isStandalone = task.projectId === "standalone" || task.isStandalone;
    const load = isStandalone
      ? listStandaloneComments(task.id)
      : isSubtask
      ? listSubtaskComments(task.projectId, task.parentTaskId, task.id)
      : listComments(task.projectId, task.id);
    Promise.resolve(load)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false));
  }, [
    isOpen,
    task.id,
    task.projectId,
    task.isStandalone,
    isSubtask,
    task.parentTaskId,
  ]);

  // Auto-scroll to comments if requested
  useEffect(() => {
    if (isOpen && scrollToComments && commentsRef.current) {
      setTimeout(() => {
        commentsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 300); // Small delay to ensure modal is fully rendered
    }
  }, [isOpen, scrollToComments]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      // Convert @Name mentions to @[userId][Name] format using our mappings
      let commentText = newComment.trim();
      Object.entries(mentionMappings).forEach(([name, userId]) => {
        // Replace @name with @[userId][name] - use word boundary to match whole names
        const regex = new RegExp(
          `@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "g"
        );
        commentText = commentText.replace(regex, `@[${userId}][${name}]`);
      });

      const payload = {
        user_id: currentUserId,
        text: commentText,
      };
      const isStandalone = task.projectId === "standalone" || task.isStandalone;
      const comment = isStandalone
        ? await addStandaloneComment(task.id, payload)
        : isSubtask
        ? await addSubtaskComment(
            task.projectId,
            task.parentTaskId,
            task.id,
            payload
          )
        : await addComment(task.projectId, task.id, payload);
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      setMentionMappings({}); // Clear mappings after posting
    } catch (err) {
      toast.error("Failed to add comment");
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editingText.trim()) return;
    try {
      const payload = { text: editingText.trim() };
      const isStandalone = task.projectId === "standalone" || task.isStandalone;
      const updated = isStandalone
        ? await editStandaloneComment(task.id, commentId, payload)
        : isSubtask
        ? await editSubtaskComment(
            task.projectId,
            task.parentTaskId,
            task.id,
            commentId,
            payload
          )
        : await editComment(task.projectId, task.id, commentId, payload);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c))
      );
      setEditingCommentId(null);
      setEditingText("");
    } catch (err) {
      toast.error("Failed to edit comment");
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const handleDeleteComment = async (commentId) => {
    setDeleteConfirmId(commentId);
  };
  const confirmDeleteComment = async () => {
    if (!deleteConfirmId) return;
    try {
      const isStandalone = task.projectId === "standalone" || task.isStandalone;
      if (isStandalone) {
        await deleteStandaloneComment(task.id, deleteConfirmId);
      } else if (isSubtask) {
        await deleteSubtaskComment(
          task.projectId,
          task.parentTaskId,
          task.id,
          deleteConfirmId
        );
      } else {
        await deleteComment(task.projectId, task.id, deleteConfirmId);
      }
      setComments((prev) => prev.filter((c) => c.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err) {
      toast.error("Failed to delete comment");
      setDeleteConfirmId(null);
    }
  };
  const cancelDeleteComment = () => setDeleteConfirmId(null);

  // Get mentionable users (assignee + collaborators, excluding current user)
  const mentionableUsers = useMemo(() => {
    const users = [];
    if (task.assigneeId && task.assigneeId !== currentUserId) {
      const assigneeInfo = getUserInfo(task.assigneeId);
      users.push({
        id: task.assigneeId,
        name: assigneeInfo.name,
        email: assigneeInfo.email,
      });
    }
    const collaboratorIds = task.collaboratorsIds || task.collaboratorIds || [];
    collaboratorIds.forEach((id) => {
      if (id && id !== task.assigneeId && id !== currentUserId) {
        const collabInfo = getUserInfo(id);
        users.push({ id, name: collabInfo.name, email: collabInfo.email });
      }
    });
    return users;
  }, [
    task.assigneeId,
    task.collaboratorsIds,
    task.collaboratorIds,
    userDetails,
    currentUserId,
  ]);

  // Filter mentionable users based on search
  const filteredMentions = useMemo(() => {
    if (!mentionSearch) return mentionableUsers;
    const search = mentionSearch.toLowerCase();
    return mentionableUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
    );
  }, [mentionableUsers, mentionSearch]);

  // State to track mention mappings (name -> id)
  const [mentionMappings, setMentionMappings] = useState({});

  // Handle comment input change with @ mention detection
  const handleCommentChange = (e) => {
    const value = e.target.value;
    setNewComment(value);

    // Detect @ mention
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMentions(true);
      setMentionSearch(mentionMatch[1]);
      setMentionPosition(mentionMatch.index);
      setSelectedMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionSearch("");
    }
  };

  // Insert mention into comment
  const insertMention = (user) => {
    const beforeMention = newComment.substring(0, mentionPosition);
    const afterMention = newComment.substring(
      commentInputRef.current.selectionStart
    );
    // Insert @Name with 2 spaces after to separate from text
    const mentionText = `@${user.name}`;
    const newText = `${beforeMention}${mentionText}  ${afterMention}`;
    setNewComment(newText);

    // Store mapping of name to ID for when we post
    setMentionMappings((prev) => ({
      ...prev,
      [user.name]: user.id,
    }));

    setShowMentions(false);
    setMentionSearch("");

    // Set cursor position after the mention and 2 spaces
    setTimeout(() => {
      if (commentInputRef.current) {
        const newPosition = beforeMention.length + mentionText.length + 2;
        commentInputRef.current.setSelectionRange(newPosition, newPosition);
        commentInputRef.current.focus();
      }
    }, 0);
  };

  // Handle keyboard navigation in mentions dropdown
  const handleCommentKeyDown = (e) => {
    if (showMentions && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < filteredMentions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredMentions.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertMention(filteredMentions[selectedMentionIndex]);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  // Render comment text with mentions highlighted
  const renderCommentText = (text) => {
    if (!text) return text;

    // Match @Name pattern - captures multi-word names properly
    // Matches @Word or @Word Word or @Word Word Word etc.
    // Stops when it hits double space, punctuation, or end
    const mentionPattern =
      /@([A-Za-z]+(?:\s[A-Za-z]+)*)(?=\s\s|\s[^A-Za-z]|$|[.,!?;:])/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionPattern.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add mention with blue background AND blue text
      const userName = match[1];
      parts.push(
        <span
          key={match.index}
          className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-medium mx-0.5"
        >
          @{userName}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  console.log("Task in modal:", {
    projectId: task.projectId,
    taskId: task.id,
    isOpen,
    isSubtask,
  });

  // Use Firebase user data if available, otherwise fall back to existing logic
  const assignee = (() => {
    if (task.assigneeId && userDetails[task.assigneeId]) {
      return getUserInfo(task.assigneeId);
    }
    // Fallback to existing logic
    return typeof task.assigneeSummary === "object" && task.assigneeSummary
      ? task.assigneeSummary
      : (() => {
          const id = String(task.assigneeId || task.ownerId || "");
          return id
            ? { id, name: `User ${id.slice(0, 4)}`, role: "Member", avatar: "" }
            : { name: "Unassigned", role: "" };
        })();
  })();

  const creator = (() => {
    const creatorId = task.createdBy || task.ownerId;
    if (creatorId && userDetails[creatorId]) {
      return getUserInfo(creatorId);
    }
    // Fallback to existing logic
    return {
      name:
        task.creatorName ||
        (task.creatorSummary && task.creatorSummary.name) ||
        (creatorId ? `User ${String(creatorId).slice(0, 4)}` : "Unknown"),
      initials: toInitials(
        task.creatorName || (creatorId ? String(creatorId).slice(0, 4) : "?")
      ),
    };
  })();

  const tags = Array.isArray(task.tags) ? task.tags : [];

  const normalizeCollaborator = (value, index = 0) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string") {
      const id = value.trim();
      if (!id) return null;
      // Use Firebase data if available
      if (userDetails[id]) {
        return getUserInfo(id);
      }
      return {
        id,
        name: `User ${id.slice(0, 4) || index + 1}`,
        email: "",
        role: "",
        avatar: "",
      };
    }
    if (typeof value === "object") {
      const rawId =
        value.id ??
        value.uid ??
        value.userId ??
        value.email ??
        value.name ??
        index;
      const id = String(rawId ?? index).trim();
      if (!id) return null;

      // Use Firebase data if available
      if (userDetails[id]) {
        return getUserInfo(id);
      }

      const nameCandidate = [
        value.name,
        value.fullName,
        value.displayName,
        value.email,
      ].find((item) => typeof item === "string" && item.trim());
      return {
        id,
        name: nameCandidate
          ? nameCandidate.trim()
          : `User ${id.slice(0, 4) || index + 1}`,
        email: typeof value.email === "string" ? value.email : "",
        role: typeof value.role === "string" ? value.role : "",
        avatar: value.avatar || value.photoURL || "",
      };
    }
    return null;
  };

  const collaborators = (() => {
    const candidateLists = [
      Array.isArray(task.collaborators) ? task.collaborators : null,
      Array.isArray(task.collaboratorSummaries)
        ? task.collaboratorSummaries
        : null,
      Array.isArray(task.collaboratorDetails) ? task.collaboratorDetails : null,
    ];
    const explicitList = candidateLists.find(
      (list) => Array.isArray(list) && list.length
    );

    const fromNames = (() => {
      const ids = Array.isArray(task.collaboratorIds)
        ? task.collaboratorIds
        : Array.isArray(task.collaboratorsIds)
        ? task.collaboratorsIds
        : [];
      const names = Array.isArray(task.collaboratorNames)
        ? task.collaboratorNames
        : [];
      if (!ids.length) return [];
      return ids.map((id, index) => ({ id, name: names[index] }));
    })();

    const base = explicitList && explicitList.length ? explicitList : fromNames;

    const normalized = (base || [])
      .map((item, index) => normalizeCollaborator(item, index))
      .filter(Boolean);

    const deduped = [];
    const seen = new Set();
    normalized.forEach((item, index) => {
      const key = String(item.id ?? index);
      if (!key || seen.has(key)) return;
      seen.add(key);
      deduped.push(item);
    });

    return deduped;
  })();

  const priorityDisplay = (() => {
    const raw = task.priority ?? task.priorityNumber;
    const value = Number(raw);
    return Number.isFinite(value) ? String(value) : "";
  })();

  const TAG_BASE =
    "rounded-full px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1";

  const getStatusColor = (statusRaw) => {
    const s = String(statusRaw || "").toLowerCase();
    if (s === "to-do" || s === "todo")
      return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
    if (s === "in progress" || s === "in-progress")
      return `${TAG_BASE} bg-blue-100 text-blue-700 border border-blue-200`;
    if (s === "completed" || s === "done")
      return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
    if (s === "blocked")
      return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
    return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
  };

  const getPriorityColor = (priorityRaw) => {
    const value = Number(priorityRaw);
    if (!Number.isFinite(value)) {
      return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
    }
    if (value >= 8) {
      return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
    }
    if (value >= 5) {
      return `${TAG_BASE} bg-yellow-100 text-yellow-700 border border-yellow-200`;
    }
    return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
  };

  const fmt = (d) =>
    d && toDate(d)
      ? toDate(d).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const isOverdue = (() => {
    const due = toDate(task.dueDate);
    return !!due && due < new Date() && task.status !== "completed";
  })();

  const getStatusLabel = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "to-do" || s === "todo") return "To-Do";
    if (s === "in progress" || s === "in-progress") return "In Progress";
    if (s === "completed" || s === "done") return "Completed";
    if (s === "blocked") return "Blocked";
    return "Unknown";
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-bold text-foreground pr-4">
                  {task.title}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getStatusColor(task.status)}>
                    {getStatusLabel(task.status)}
                  </Badge>
                  <Badge className={getPriorityColor(priorityDisplay)}>
                    {priorityDisplay || "—"}
                  </Badge>
                  {isOverdue && (
                    <Badge
                      className={`${TAG_BASE} bg-red-100 text-red-700 border border-red-200`}
                    >
                      Overdue
                    </Badge>
                  )}
                  {isSubtask && (
                    <Badge
                      className={`${TAG_BASE} bg-purple-100 text-purple-700 border border-purple-200`}
                    >
                      Subtask
                    </Badge>
                  )}
                  {task.isRecurring && (
                    <Badge
                      className={`${TAG_BASE} bg-indigo-100 text-indigo-700 border border-indigo-200`}
                    >
                      Recurring
                    </Badge>
                  )}
                  {(task.isStandalone || task.projectId === "standalone") && (
                    <Badge
                      className={`${TAG_BASE} bg-purple-100 text-purple-700 border border-purple-200`}
                    >
                      Standalone
                    </Badge>
                  )}
                </div>
                {task.projectName && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    Project:{" "}
                    {task.projectName === "Standalone"
                      ? "N/A"
                      : task.projectName}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-8 sm:mt-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disableActions || typeof onEdit !== "function"}
                  onClick={() => {
                    if (disableActions || typeof onEdit !== "function") return;
                    onEdit(task);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disableActions || typeof onDelete !== "function"}
                  onClick={() => {
                    if (disableActions || typeof onDelete !== "function")
                      return;
                    onDelete(task);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                Description
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {task.description || "—"}
              </p>
            </div>
            {/* Subtasks Section - Only show for parent tasks */}
            {!isSubtask && task.projectId && task.id && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        Subtasks
                      </h3>
                      {(task.subtaskCount || 0) > 0 && (
                        <Badge variant="secondary">
                          {task.subtaskCompletedCount || 0}/
                          {task.subtaskCount || 0}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSubtaskDialog(true)}
                      disabled={disableActions}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Subtask
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  {(task.subtaskCount || 0) > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{task.subtaskProgress || 0}%</span>
                      </div>
                      <Progress
                        value={task.subtaskProgress || 0}
                        className="h-2"
                      />
                    </div>
                  )}

                  <SubtasksList
                    projectId={task.projectId}
                    taskId={task.id}
                    parentTask={task}
                    onSubtaskClick={onSubtaskClick}
                    refreshKey={subtaskRefreshKey}
                    onSubtaskChange={async () => {
                      if (typeof onSubtaskChange === "function")
                        await onSubtaskChange();
                      setSubtaskRefreshKey((prev) => prev + 1);
                    }}
                  />
                </div>
                <Separator />
              </>
            )}

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Assigned to
                    </p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={assignee.avatar || "/placeholder.svg"}
                          alt={assignee.name}
                        />
                        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                          {assignee.initials || toInitials(assignee.name || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {assignee.name || "Unassigned"}
                        </p>
                        {assignee.role && (
                          <p className="text-xs text-muted-foreground">
                            {assignee.role}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Created by
                    </p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={creator.avatar || "/placeholder.svg"}
                          alt={creator.name}
                        />
                        <AvatarFallback className="text-xs font-semibold bg-muted">
                          {creator.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {creator.name}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Collaborators
                    </p>
                    {collaborators.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No collaborators added.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {collaborators.map((person, idx) => (
                          <div
                            key={person.id || person.email || idx}
                            className="flex items-center gap-2"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={person.avatar || "/placeholder.svg"}
                                alt={person.name}
                              />
                              <AvatarFallback className="text-xs font-semibold bg-muted">
                                {person.initials ||
                                  toInitials(person.name || "")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {person.name}
                              </p>
                              {(person.email || person.role) && (
                                <p className="text-xs text-muted-foreground">
                                  {[person.email, person.role]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Due Date
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        isOverdue ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {fmt(task.dueDate)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Created
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {fmt(task.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Last Updated
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {fmt(task.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Tags</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            {tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Tags</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            {task.isRecurring && task.recurrencePattern && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    {" "}
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">
                      Recurrence
                    </h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground min-w-[80px]">
                        Pattern:
                      </span>
                      <span className="text-foreground">
                        {(() => {
                          const pattern = task.recurrencePattern;
                          const frequency = pattern.frequency || "daily";
                          const interval = pattern.interval || 1;
                          const frequencyMap = {
                            daily: { singular: "day", plural: "days" },
                            weekly: { singular: "week", plural: "weeks" },
                            monthly: { singular: "month", plural: "months" },
                            yearly: { singular: "year", plural: "years" },
                          };

                          const freqWord = frequencyMap[frequency];
                          const unit =
                            interval === 1
                              ? freqWord.singular
                              : freqWord.plural;

                          return interval === 1
                            ? `Every ${unit}`
                            : `Every ${interval} ${unit}`;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground min-w-[80px]">
                        Ends:
                      </span>
                      <span className="text-foreground">
                        {(() => {
                          const pattern = task.recurrencePattern;
                          const endCondition = pattern.endCondition || "never";
                          if (endCondition === "never") return "Never";
                          if (endCondition === "after_count")
                            return `After ${pattern.maxCount} occurrences`;
                          if (endCondition === "on_date")
                            return `On ${
                              toDate(pattern.endDate)?.toLocaleDateString() ||
                              "—"
                            }`;
                          return "—";
                        })()}
                      </span>
                    </div>
                    {task.recurringInstanceCount > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground min-w-[80px]">
                          Instance:
                        </span>
                        <span className="text-foreground">
                          #{task.recurringInstanceCount}
                        </span>
                      </div>
                    )}
                    <div className="mt-3 p-3 bg-muted/50 rounded-md border border-border">
                      <p className="text-xs text-muted-foreground">
                        <strong>Note:</strong> To change recurrence settings,
                        delete this task and create a new one with updated
                        settings.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div ref={commentsRef}>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Comments</h3>
                <Badge variant="secondary">{comments.length}</Badge>
              </div>
              {loadingComments ? (
                <p className="text-sm text-muted-foreground">
                  Loading comments...
                </p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="flex gap-3 p-3 bg-muted rounded-lg"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={comment.user_avatar || "/placeholder.svg"}
                          alt={comment.author || "User"}
                        />
                        <AvatarFallback className="text-xs">
                          {toInitials(comment.author || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground">
                            {comment.author || "User"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(comment.timestamp)}
                          </p>
                          {comment.edited && (
                            <span className="text-xs text-muted-foreground">
                              (edited)
                            </span>
                          )}
                        </div>
                        {editingCommentId === comment.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleEditComment(comment.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingCommentId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground">
                            {renderCommentText(comment.text)}
                          </p>
                        )}
                      </div>
                      {comment.user_id === currentUserId &&
                        editingCommentId !== comment.id && (
                          <div className="flex flex-col gap-1">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingText(comment.text);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => handleDeleteComment(comment.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      {/* Delete Comment Confirmation Dialog */}
                      <Dialog
                        open={!!deleteConfirmId}
                        onOpenChange={cancelDeleteComment}
                      >
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Comment</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete this comment? This
                              action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              onClick={cancelDeleteComment}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={confirmDeleteComment}
                            >
                              Delete
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-4 relative">
                <div className="flex-1 relative">
                  <Input
                    ref={commentInputRef}
                    value={newComment}
                    onChange={handleCommentChange}
                    onKeyDown={handleCommentKeyDown}
                    placeholder="Add a comment... (Type @ to mention someone)"
                    className="flex-1"
                  />
                  {showMentions && filteredMentions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredMentions.map((user, index) => (
                        <div
                          key={user.id}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                            index === selectedMentionIndex ? "bg-blue-50" : ""
                          }`}
                          onClick={() => insertMention(user)}
                          onMouseEnter={() => setSelectedMentionIndex(index)}
                        >
                          <div className="font-medium text-sm">{user.name}</div>
                          <div className="text-xs text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                >
                  Post
                </Button>
              </div>
            </div>

            {(task.attachments || []).length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">
                      Attachments
                    </h3>
                    <Badge variant="secondary">
                      {(task.attachments || []).length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {(task.attachments || []).map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-muted rounded"
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {attachment}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <SubtaskDialog
        isOpen={showSubtaskDialog}
        onClose={() => setShowSubtaskDialog(false)}
        projectId={task.projectId}
        taskId={task.id}
        teamMembers={teamMembers}
        currentUserId={currentUserId}
        isStandalone={task.isStandalone || task.projectId === "standalone"}
        onSubtaskCreated={async () => {
          setShowSubtaskDialog(false);
          setSubtaskRefreshKey((prev) => prev + 1);
          if (typeof onSubtaskChange === "function") await onSubtaskChange();
        }}
      />
    </>
  );
}

// Keep all your existing SubtasksList, SubtaskDialog components exactly as they were
function SubtasksList({
  projectId,
  taskId,
  parentTask,
  onSubtaskClick,
  onSubtaskChange,
  refreshKey,
}) {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSubtasks = async () => {
    try {
      if (subtasks.length === 0) {
        setLoading(true);
      }
      const isStandalone =
        parentTask?.isStandalone || projectId === "standalone";
      const data = isStandalone
        ? await listStandaloneSubtasks(taskId)
        : await listSubtasks(projectId, taskId);
      setSubtasks(data || []);
    } catch (err) {
      console.error("Failed to load subtasks:", err);
      setSubtasks([]);
      toast.error("Failed to load subtasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId && taskId) {
      loadSubtasks();
    }
  }, [projectId, taskId, refreshKey]);

  const handleToggleStatus = async (subtask) => {
    const newStatus = subtask.status === "completed" ? "to-do" : "completed";
    try {
      // Optimistic update
      setSubtasks((prev) => {
        const updated = prev.map((s) =>
          s.id === subtask.id ? { ...s, status: newStatus } : s
        );
        return updated;
      });

      const isStandalone =
        parentTask?.isStandalone || projectId === "standalone";
      if (isStandalone) {
        await updateStandaloneSubtask(taskId, subtask.id, {
          status: newStatus,
        });
      } else {
        await updateSubtask(projectId, taskId, subtask.id, {
          status: newStatus,
        });
      }

      if (onSubtaskChange) {
        await onSubtaskChange();
      }

      await loadSubtasks();
      toast.success(
        `Subtask marked as ${
          newStatus === "completed" ? "completed" : "incomplete"
        }`
      );
    } catch (err) {
      console.error("Failed to update subtask:", err);
      await loadSubtasks(); // Revert on error
      toast.error("Failed to update subtask");
    }
  };

  const handleDeleteSubtask = async (subtask) => {
    if (!confirm("Delete this subtask?")) return;
    try {
      // Optimistic removal
      setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));

      const isStandalone =
        parentTask?.isStandalone || projectId === "standalone";
      if (isStandalone) {
        await deleteStandaloneSubtask(taskId, subtask.id);
      } else {
        await deleteSubtask(projectId, taskId, subtask.id);
      }

      if (onSubtaskChange) await onSubtaskChange();
      await loadSubtasks();
      toast.success("Subtask deleted successfully");
    } catch (err) {
      console.error("Failed to delete subtask:", err);
      await loadSubtasks(); // Revert on error
      toast.error("Failed to delete subtask");
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading subtasks...</p>;
  }

  if (subtasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No subtasks yet. Click "Add Subtask" to create one.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {subtasks.map((subtask) => (
        <div
          key={subtask.id}
          className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition"
        >
          <button
            onClick={() => handleToggleStatus(subtask)}
            className="flex-shrink-0"
          >
            {subtask.status === "completed" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => {
              if (onSubtaskClick && parentTask) {
                onSubtaskClick(subtask, parentTask);
              }
            }}
          >
            <p
              className={`text-sm ${
                subtask.status === "completed"
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {subtask.title}
            </p>
            {subtask.description && (
              <p className="text-xs text-muted-foreground truncate">
                {subtask.description}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="flex-shrink-0"
            onClick={() => handleDeleteSubtask(subtask)}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function SubtaskDialog({
  isOpen,
  onClose,
  projectId,
  taskId,
  teamMembers = [],
  currentUserId,
  isStandalone = false, // ADD THIS
  onSubtaskCreated,
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "to-do",
    priority: "5",
    dueDate: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedCollaborators, setSelectedCollaborators] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setForm({
        title: "",
        description: "",
        status: "to-do",
        priority: "5",
        dueDate: "",
        tags: "",
      });
      // Default to current user as assignee
      setSelectedCollaborators(currentUserId ? [currentUserId] : []);
      setError("");
      setSaving(false);
    }
  }, [isOpen, currentUserId]);

  const handleCollaboratorToggle = (userId, checked) => {
    setSelectedCollaborators((prev) =>
      checked ? [...prev, userId] : prev.filter((id) => id !== userId)
    );
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const title = form.title.trim();
    if (!title) {
      setError("Subtask title is required.");
      return;
    }

    if (!form.dueDate) {
      setError("Due date is required.");
      return;
    }

    if (selectedCollaborators.length === 0) {
      setError("At least one assignee is required.");
      return;
    }

    // For standalone subtasks, only allow current user
    if (isStandalone && selectedCollaborators.length > 1) {
      setError("Standalone subtasks can only be assigned to you.");
      return;
    }

    if (selectedCollaborators.length > 5) {
      setError("Maximum 5 assignees allowed per subtask.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const tags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      // First assignee is primary, rest are collaborators
      const [primaryAssignee, ...otherAssignees] = selectedCollaborators;

      const payload = {
        title,
        description: form.description.trim(),
        status: form.status,
        priority: Number(form.priority),
        assigneeId: primaryAssignee,
        ownerId: primaryAssignee,
        collaboratorsIds: otherAssignees.length > 0 ? otherAssignees : [],
        tags,
        createdBy: currentUserId,
      };

      const due = new Date(`${form.dueDate}T00:00:00`);
      if (Number.isNaN(due.getTime())) {
        setError("Please provide a valid due date.");
        setSaving(false);
        return;
      }
      payload.dueDate = due.toISOString();

      // USE CORRECT API BASED ON isStandalone
      if (isStandalone) {
        await createStandaloneSubtask(taskId, payload);
      } else {
        await createSubtask(projectId, taskId, payload);
      }

      toast.success("Subtask created successfully!");
      if (onSubtaskCreated) await onSubtaskCreated();
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to create subtask");
      setSaving(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: "to-do", label: "To-Do" },
    { value: "in progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "blocked", label: "Blocked" },
  ];

  const PRIORITY_VALUES = Array.from({ length: 10 }, (_, i) => String(i + 1));

  // FILTER TEAM MEMBERS FOR STANDALONE
  const availableTeamMembers = isStandalone
    ? teamMembers.filter(
        (member) => (member.id || member.uid) === currentUserId
      )
    : teamMembers;

  const collaboratorOptions = availableTeamMembers.map((member) => ({
    id: member.id || member.uid,
    label:
      member.fullName ||
      member.displayName ||
      member.email ||
      member.name ||
      member.id,
    email: member.email,
  }));

  const collaboratorButtonLabel =
    selectedCollaborators.length === 0
      ? "Select assignees"
      : selectedCollaborators.length === 1
      ? collaboratorOptions.find((opt) => opt.id === selectedCollaborators[0])
          ?.label || "1 assignee"
      : `${selectedCollaborators.length} assignees`;

  const isSubmitDisabled = saving;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Add Subtask</DialogTitle>
            <DialogDescription>
              Provide details for the new subtask. You can adjust them later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="subtask-title"
                className="text-sm font-medium text-foreground"
              >
                Title
              </label>
              <Input
                id="subtask-title"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder="Design login screen"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="subtask-description"
                className="text-sm font-medium text-foreground"
              >
                Description
              </label>
              <textarea
                id="subtask-description"
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Wireframes + final design in Figma"
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="subtask-status"
                  className="text-sm font-medium text-foreground"
                >
                  Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(value) => updateForm("status", value)}
                >
                  <SelectTrigger id="subtask-status" className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="subtask-priority"
                  className="text-sm font-medium text-foreground"
                >
                  Priority
                </label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => updateForm("priority", value)}
                >
                  <SelectTrigger id="subtask-priority" className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_VALUES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  10 = Most Urgent, 1 = Least Urgent
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="subtask-due"
                className="text-sm font-medium text-foreground"
              >
                Due date <span className="text-destructive">*</span>
              </label>
              <Input
                id="subtask-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => updateForm("dueDate", e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Required field</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Assignees <span className="text-destructive">*</span>
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={`w-full justify-between ${
                      selectedCollaborators.length > 5
                        ? "border-destructive"
                        : ""
                    }`}
                    disabled={isStandalone} // Disable for standalone
                  >
                    <span className="truncate text-left">
                      {collaboratorButtonLabel}
                    </span>
                    <span
                      className={`text-xs ${
                        selectedCollaborators.length > 5
                          ? "text-destructive font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {selectedCollaborators.length}/5 selected
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <DropdownMenuLabel>Select assignees</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {collaboratorOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {isStandalone
                        ? "Only you can be assigned to standalone subtasks"
                        : "Add team members to this project first."}
                    </div>
                  ) : (
                    collaboratorOptions.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.id}
                        checked={selectedCollaborators.includes(option.id)}
                        onCheckedChange={(checked) =>
                          handleCollaboratorToggle(option.id, checked)
                        }
                      >
                        <div className="flex flex-col">
                          <span className="leading-tight">{option.label}</span>
                          {option.email && option.email !== option.label && (
                            <span className="text-xs text-muted-foreground leading-tight">
                              {option.email}
                            </span>
                          )}
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-xs text-muted-foreground">
                {isStandalone
                  ? "Standalone subtasks can only be assigned to you."
                  : "Required: Select 1-5 team members to assign this subtask to."}
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="subtask-tags"
                className="text-sm font-medium text-foreground"
              >
                Tags
              </label>
              <Input
                id="subtask-tags"
                value={form.tags}
                onChange={(e) => updateForm("tags", e.target.value)}
                placeholder="design, UI"
              />
              <p className="text-xs text-muted-foreground">
                Separate tags with commas.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {saving ? "Creating..." : "Create Subtask"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

TaskDetailModal.propTypes = {
  task: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    status: PropTypes.string,
    priority: PropTypes.number,
    dueDate: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
      PropTypes.object,
    ]),
    createdAt: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
      PropTypes.object,
    ]),
    updatedAt: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
      PropTypes.object,
    ]),
    projectId: PropTypes.string,
    projectName: PropTypes.string,
    assigneeId: PropTypes.string,
    createdBy: PropTypes.string,
    ownerId: PropTypes.string,
    collaboratorsIds: PropTypes.arrayOf(PropTypes.string),
    collaboratorIds: PropTypes.arrayOf(PropTypes.string),
    tags: PropTypes.arrayOf(PropTypes.string),
    attachments: PropTypes.arrayOf(PropTypes.string),
    isSubtask: PropTypes.bool,
    parentTaskId: PropTypes.string,
    isStandalone: PropTypes.bool,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  disableActions: PropTypes.bool,
  teamMembers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      email: PropTypes.string,
      role: PropTypes.string,
    })
  ),
  currentUserId: PropTypes.string,
  onSubtaskChange: PropTypes.func,
  onSubtaskClick: PropTypes.func,
};
