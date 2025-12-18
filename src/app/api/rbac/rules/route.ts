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
import { ApiResponse, CustomSession } from '@/lib/types';
import { isUserAdmin } from '@/lib/rbac';

// Type definitions
interface RbacRule {
  id: number;
  bucketName: string;
  path: string | null;
  accessType: 'READ' | 'WRITE';
  includeSubfolders: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  ruleGroups: Array<{
    id: number;
    groupName: string;
    isAdmin: boolean;
    createdAt: Date;
  }>;
}

interface GroupData {
  name: string;
  isAdmin?: boolean;
}

interface RbacRuleRequest {
  bucketName: string;
  path?: string | null;
  accessType: 'READ' | 'WRITE';
  includeSubfolders?: boolean;
  description?: string;
  groupNames: string[] | GroupData[];
}

interface RbacRuleUpdateRequest {
  bucketName?: string;
  path?: string | null;
  accessType?: 'READ' | 'WRITE';
  includeSubfolders?: boolean;
  description?: string;
  groupNames?: string[] | GroupData[];
}

/**
 * GET /api/rbac/rules
 * List all RBAC rules with optional filtering
 * Query params:
 *   - bucketName?: string - Filter by bucket name
 *   - path?: string - Filter by path
 *   - accessType?: READ|WRITE - Filter by access type
 *   - groupName?: string - Filter by group name
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<RbacRule[]>>> {
  try {
    const session  = await getServerSession(authOptions) as CustomSession | null;
    
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
    const admin = await isUserAdmin(session.user?.groups || []);
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
    const groupName = searchParams.get('groupName');

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

    if (groupName) {
      where.ruleGroups = {
        some: {
          groupName: {
            contains: groupName,
            mode: 'insensitive',
          },
        },
      };
    }

    const rules = await prisma.rbacAccessRule.findMany({
      where,
      include: {
        ruleGroups: {
          select: {
            id: true,
            groupName: true,
            isAdmin: true,
            createdAt: true,
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
 *   - groupNames: string[] (required, at least one group)
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<RbacRule>>> {
  try {
    const session = await getServerSession(authOptions) as CustomSession | null;
    
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
    const admin = await isUserAdmin(session.user?.groups || []);
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

    if (!body.groupNames || body.groupNames.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'At least one group name is required',
        },
        { status: 400 }
      );
    }

    // Check for duplicate rule
    const existingRule = await prisma.rbacAccessRule.findUnique({
      where: {
        unique_bucket_path_access: {
          bucketName: body.bucketName,
          path: body.path || '',
          accessType: body.accessType,
        },
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
        ruleGroups: {
          createMany: {
            data: body.groupNames.map((group) => {
              // Handle both string and object formats
              const groupName = typeof group === 'string' ? group : group.name;
              const isAdmin = typeof group === 'string' ? false : (group.isAdmin || false);
              return {
                groupName,
                isAdmin,
              };
            }),
          },
        },
      },
      include: {
        ruleGroups: {
          select: {
            id: true,
            groupName: true,
            createdAt: true,
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
 *   - groupNames?: string[]
 */
export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<RbacRule>>> {
  try {
    const session = await getServerSession(authOptions) as CustomSession | null;
    
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
    const admin = await isUserAdmin(session.user?.groups || []);
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
        ruleGroups: {
          select: {
            id: true,
            groupName: true,
            createdAt: true,
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
      include: {
        ruleGroups: {
          select: {
            id: true,
            groupName: true,
            isAdmin: true,
            createdAt: true,
          },
        },
      },
    });

    // Handle group updates if provided
    if (body.groupNames && body.groupNames.length > 0) {
      // Delete existing groups
      await prisma.rbacRuleGroup.deleteMany({
        where: { ruleId },
      });

      // Create new groups
      await prisma.rbacRuleGroup.createMany({
        data: body.groupNames.map((group) => {
          // Handle both string and object formats
          const groupName = typeof group === 'string' ? group : group.name;
          const isAdmin = typeof group === 'string' ? false : (group.isAdmin || false);
          return {
            ruleId,
            groupName,
            isAdmin,
          };
        }),
      });

      // Refresh the rule to include updated groups
      const refreshedRule = await prisma.rbacAccessRule.findUnique({
        where: { id: ruleId },
        include: {
          ruleGroups: {
            select: {
              id: true,
              groupName: true,
              createdAt: true,
            },
          },
        },
      });

      if (refreshedRule) {

        return NextResponse.json(
          {
            success: true,
            data: refreshedRule,
          },
          { status: 200 }
        );
      }
    

    return NextResponse.json(
      {
        success: true,
        data: updatedRule,
      },
      { status: 200 }
    );}

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
    const session = await getServerSession(authOptions) as CustomSession | null;
    
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
    const admin = await isUserAdmin(session.user?.groups || []);
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

    // Get existing rule for audit logging
    const existingRule = await prisma.rbacAccessRule.findUnique({
      where: { id: ruleId },
      include: {
        ruleGroups: {
          select: {
            groupName: true,
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

    // Delete the rule (cascade deletes ruleGroups)
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
