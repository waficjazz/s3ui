import { DefaultSession } from "next-auth";
import { User } from "@prisma/client";
import { JWT } from "next-auth/jwt";

export interface User {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id?: string;
    preferred_username?: string;
    groups?: string[];
    isAdmin: boolean ;
    permissions?: Record<string, any>;
}

declare module "next-auth" {
  interface Session {
    user: User & DefaultSession["user"];
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }


}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    groups?: string[];
    permissions?: Record<string, any>; // { "bucket/path": { accessType, includeSubfolders } }
    permissionsHash?: string;
    permissionsRefreshedAt?: number;
    isAdmin: boolean ;
  }
}