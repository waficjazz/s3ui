import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ApiResponse } from '@/lib/types';
import { RbacGroup } from '@prisma/client';

interface GroupData {
  groupName: string;
  isAdmin?: boolean;
}

/**
 * GET /api/rbac/groups
 * Fetch all groups, optionally filtered by isAdmin status
 * Query params:
 *   - isAdmin?: 'true' | 'false' - Filter by admin status
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<RbacGroup[]>>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        { status: 401 }
      );
    }

    // Check admin permission
    const admin = (session.user).isAdmin;
    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'Only administrators can view RBAC groups',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isAdminFilter = searchParams.get('isAdmin');

    const where: any = {};
    
    // Filter by isAdmin if provided
    if (isAdminFilter !== null) {
      where.isAdmin = isAdminFilter === 'true';
    }

    const groups = await prisma.rbacGroup.findMany({
      where,
      orderBy: {
        groupName: 'asc',
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: groups,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RBAC Groups] Error fetching groups:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching RBAC groups',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rbac/groups
 * Create a new group
 * Body:
 *   - groupName: string (required)
 *   - isAdmin?: boolean (default: false)
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<RbacGroup>>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        { status: 401 }
      );
    }

    // Check admin permission
    const admin = (session.user as any).isAdmin;
    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'Only administrators can create groups',
        },
        { status: 403 }
      );
    }

    const body: GroupData = await request.json();

    // Validation
    if (!body.groupName || !body.groupName.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Group name is required',
        },
        { status: 400 }
      );
    }

    // Check if group already exists
    const existingGroup = await prisma.rbacGroup.findUnique({
      where: {
        groupName: body.groupName.trim(),
      },
    });

    if (existingGroup) {
      return NextResponse.json(
        {
          success: false,
          error: 'CONFLICT',
          message: 'A group with this name already exists',
        },
        { status: 409 }
      );
    }

    // Create the group directly
    const newGroup = await prisma.rbacGroup.create({
      data: {
        groupName: body.groupName.trim(),
        isAdmin: body.isAdmin || false,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: newGroup,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[RBAC Groups] Error creating group:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create group',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rbac/groups
 * Update a group's admin status or name
 * Query params:
 *   - id: number (required) - Group ID
 * Body:
 *   - groupName?: string (new name)
 *   - isAdmin?: boolean (admin status)
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<ApiResponse<RbacGroup>>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        { status: 401 }
      );
    }

    // Check admin permission
    const admin = (session.user as any).isAdmin;
    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'Only administrators can update groups',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const groupId = parseInt(searchParams.get('id') || '0');

    if (!groupId) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Group ID is required',
        },
        { status: 400 }
      );
    }

    // Get existing group
    const existingGroup = await prisma.rbacGroup.findUnique({
      where: { id: groupId },
    });

    if (!existingGroup) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Group not found',
        },
        { status: 404 }
      );
    }

    const body: GroupData = await request.json();

    const updateData: any = {};

    if (body.groupName && body.groupName.trim()) {
      // Check if new name already exists
      const nameExists = await prisma.rbacGroup.findUnique({
        where: {
          groupName: body.groupName.trim(),
        },
      });

      if (nameExists && nameExists.id !== groupId) {
        return NextResponse.json(
          {
            success: false,
            error: 'CONFLICT',
            message: 'A group with this name already exists',
          },
          { status: 409 }
        );
      }

      updateData.groupName = body.groupName.trim();
    }

    if (body.isAdmin !== undefined) {
      updateData.isAdmin = body.isAdmin;
    }

    const updatedGroup = await prisma.rbacGroup.update({
      where: { id: groupId },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        data: updatedGroup,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RBAC Groups] Error updating group:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update group',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rbac/groups
 * Delete a group
 * Query params:
 *   - id: number (required) - Group ID
 */
export async function DELETE(
  request: NextRequest
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        { status: 401 }
      );
    }

    // Check admin permission
    const admin = (session.user as any).isAdmin;
    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'Only administrators can delete groups',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const groupId = parseInt(searchParams.get('id') || '0');

    if (!groupId) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Group ID is required',
        },
        { status: 400 }
      );
    }

    // Get existing group
    const existingGroup = await prisma.rbacGroup.findUnique({
      where: { id: groupId },
    });

    if (!existingGroup) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Group not found',
        },
        { status: 404 }
      );
    }

    // Delete the group (cascade will delete associated rules)
    await prisma.rbacGroup.delete({
      where: { id: groupId },
    });

    return NextResponse.json(
      {
        success: true,
        data: null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RBAC Groups] Error deleting group:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete group',
      },
      { status: 500 }
    );
  }
}