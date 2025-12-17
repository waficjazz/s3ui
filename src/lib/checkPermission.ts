import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import { hasPermission } from './rbac';
import { CustomSession } from './types';

export async function checkUserPermission(
  bucket: string,
  path: string,
  requiredAccess: 'READ' | 'WRITE'
) {
  const session : CustomSession | null = await getServerSession(authOptions);
  
  if (!session?.user) {
    throw new Error('Unauthorized: Not authenticated');
  }

  const userPermissions = (session.user).permissions;
  
  if (!userPermissions) {
    throw new Error('Unauthorized: No permissions found');
  }

  const allowed = hasPermission(
    userPermissions,
    bucket,
    path,
    requiredAccess
  );

  if (!allowed) {
    throw new Error(`Forbidden: User lacks ${requiredAccess} access to ${bucket}${path}`);
  }

  return true;
}