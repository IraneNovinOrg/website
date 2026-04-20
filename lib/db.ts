// Re-export everything from the SQLite-based db module
// This file exists for backward compatibility — all imports from "@/lib/db" still work
export {
  getDb,
  getUserById,
  getUserByEmail,
  getUserCount,
  createUser,
  verifyUser,
  upsertOAuthUser,
  updateProfile,
  castVote,
  getVoteCount,
  findOptedInExperts,
  findUsersBySkills,
  createNotification,
  getUnreadNotifications,
  markNotificationRead,
  logActivity,
  type UserProfile,
} from "./db/index";
