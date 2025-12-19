/**
 * API Route: /api/rbac/rules
 * Manages RBAC access rules
 * 
 * GET - List all RBAC rules with optional filtering
 * POST - Create a new RBAC rule
 * PUT - Update an existing RBAC rule
 * DELETE - Delete an RBAC rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ApiResponse, RbacGroup, RbacRule } from '@/lib/types';



interface RbacRuleRequest {
  bucketName: string;
  path?: string | null;
  accessType: 'READ' | 'WRITE';
  includeSubfolders?: boolean;
  description?: string;
  groupIds: number[];
}

interface RbacRuleUpdateRequest {
  bucketName?: string;
  path?: string | null;
  accessType?: 'READ' | 'WRITE';
  includeSubfolders?: boolean;
  description?: string;
  groupIds?: number[];
}

/**
 * GET /api/rbac/rules
 * List all RBAC rules with optional filtering
 * Query params:
 *   - bucketName?: string - Filter by bucket name
 *   - path?: string - Filter by path
 *   - accessType?: READ|WRITE - Filter by access type
 *   - groupId?: number - Filter by group ID
 */
export async function GET(request: NextRequest) : Promise<NextResponse<ApiResponse<RbacRule[]>>> {
  try {
    const session  = await getServerSession(authOptions) ;
    
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
          message: 'Only administrators can view RBAC rules',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bucketName = searchParams.get('bucketName');
    const path = searchParams.get('path');
    const accessType = searchParams.get('accessType');
    const groupId = searchParams.get('groupId');

    // Build filter conditions
    const where: any = {};

    if (bucketName) {
      where.bucketName = {
        contains: bucketName,
        mode: 'insensitive',
      };
    }

    if (path !== null) {
      where.path = path || null;
    }

    if (accessType && ['READ', 'WRITE'].includes(accessType)) {
      where.accessType = accessType;
    }

    if (groupId) {
      where.groups = {
        some: {
          groupId: parseInt(groupId),
        },
      };
    }

    const rules = await prisma.rbacAccessRule.findMany({
      where,
      include: {
        groups: {
          include: {
            group: {
              select: {
                id: true,
                groupName: true,
                isAdmin: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ bucketName: 'asc' }, { path: 'asc' }],
    });

    return NextResponse.json(
      {
        success: true,
        data: rules,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RBAC] Error fetching rules:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch RBAC rules',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rbac/rules
 * Create a new RBAC rule
 * Body:
 *   - bucketName: string (required)
 *   - path?: string | null (optional, null for bucket root)
 *   - accessType: READ | WRITE (required)
 *   - includeSubfolders?: boolean (default: true)
 *   - description?: string (optional)
 *   - groupIds: number[] (required, at least one group)
 */
export async function POST(request: NextRequest) : Promise<NextResponse<ApiResponse<RbacRule>>> {
  try {
    const session = await getServerSession(authOptions) ;
    
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
          message: 'Only administrators can create RBAC rules',
        },
        { status: 403 }
      );
    }

    const body: RbacRuleRequest = await request.json();

    // Validation
    if (!body.bucketName) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'bucketName is required',
        },
        { status: 400 }
      );
    }

    if (!body.accessType || !['READ', 'WRITE'].includes(body.accessType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'accessType must be READ or WRITE',
        },
        { status: 400 }
      );
    }

    if (!body.groupIds || body.groupIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'At least one groupId is required',
        },
        { status: 400 }
      );
    }

    // Verify all groups exist
    const groups = await prisma.rbacGroup.findMany({
      where: { id: { in: body.groupIds } },
    });

    if (groups.length !== body.groupIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'One or more groups not found',
        },
        { status: 404 }
      );
    }

    // Check for duplicate rule (same bucket/path/accessType)
    const existingRule = await prisma.rbacAccessRule.findFirst({
      where: {
        bucketName: body.bucketName,
        path: body.path || null,
        accessType: body.accessType,
      },
    });

    if (existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: 'CONFLICT',
          message: 'A rule with this bucket/path/accessType combination already exists',
        },
        { status: 409 }
      );
    }

    // Create the rule with groups
    const rule = await prisma.rbacAccessRule.create({
      data: {
        bucketName: body.bucketName,
        path: body.path || null,
        accessType: body.accessType,
        includeSubfolders: body.includeSubfolders !== false,
        description: body.description || null,
        groups: {
          createMany: {
            data: body.groupIds.map((groupId) => ({
              groupId,
            })),
          },
        },
      },
      include: {
        groups: {
          include: {
            group: {
              select: {
                id: true,
                groupName: true,
                isAdmin: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: rule ,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[RBAC] Error creating rule:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create RBAC rule',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rbac/rules
 * Update an existing RBAC rule
 * Query params:
 *   - id: number (required) - Rule ID
 * Body:
 *   - bucketName?: string
 *   - path?: string | null
 *   - accessType?: READ | WRITE
 *   - includeSubfolders?: boolean
 *   - description?: string
 *   - groupId?: number
 */
export async function PUT(request: NextRequest) {
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
          message: 'Only administrators can update RBAC rules',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ruleId = parseInt(searchParams.get('id') || '0');

    if (!ruleId) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Rule ID is required',
        },
        { status: 400 }
      );
    }

    // Get existing rule
    const existingRule = await prisma.rbacAccessRule.findUnique({
      where: { id: ruleId },
      include: {
        groups: {
          include: {
            group: {
              select: {
                id: true,
                groupName: true,
                isAdmin: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Rule not found',
        },
        { status: 404 }
      );
    }

    const body: RbacRuleUpdateRequest = await request.json();

    // Validate accessType if provided
    if (body.accessType && !['READ', 'WRITE'].includes(body.accessType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'accessType must be READ or WRITE',
        },
        { status: 400 }
      );
    }

    // Verify groups exist if groupIds are provided
    if (body.groupIds && body.groupIds.length > 0) {
      const groups = await prisma.rbacGroup.findMany({
        where: { id: { in: body.groupIds } },
      });

      if (groups.length !== body.groupIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: 'NOT_FOUND',
            message: 'One or more groups not found',
          },
          { status: 404 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (body.bucketName) updateData.bucketName = body.bucketName;
    if (body.path !== undefined) updateData.path = body.path || null;
    if (body.accessType) updateData.accessType = body.accessType;
    if (body.includeSubfolders !== undefined) updateData.includeSubfolders = body.includeSubfolders;
    if (body.description !== undefined) updateData.description = body.description || null;

    updateData.updatedAt = new Date();

    // Update rule
    const updatedRule = await prisma.rbacAccessRule.update({
      where: { id: ruleId },
      data: updateData,
    });

    // Handle group updates if provided
    if (body.groupIds) {
      // Delete existing groups
      await prisma.ruleGroup.deleteMany({
        where: { ruleId },
      });

      // Create new groups
      await prisma.ruleGroup.createMany({
        data: body.groupIds.map((groupId) => ({
          ruleId,
          groupId,
        })),
      });
    }

    // Fetch updated rule with groups
    const refreshedRule = await prisma.rbacAccessRule.findUnique({
      where: { id: ruleId },
      include: {
        groups: {
          include: {
            group: {
              select: {
                id: true,
                groupName: true,
                isAdmin: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: refreshedRule,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[RBAC] Error updating rule:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update RBAC rule',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rbac/rules
 * Delete an RBAC rule
 * Query params:
 *   - id: number (required) - Rule ID
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const session = await getServerSession(authOptions) ;
    
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
          message: 'Only administrators can delete RBAC rules',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ruleId = parseInt(searchParams.get('id') || '0');

    if (!ruleId) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Rule ID is required',
        },
        { status: 400 }
      );
    }

    // Get existing rule
    const existingRule = await prisma.rbacAccessRule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Rule not found',
        },
        { status: 404 }
      );
    }

    // Delete the rule (cascade deletes associated RuleGroup entries)
    await prisma.rbacAccessRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json(
      {
        success: true,
        data: null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RBAC] Error deleting rule:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete RBAC rule',
      },
      { status: 500 }
    );
  }
}
