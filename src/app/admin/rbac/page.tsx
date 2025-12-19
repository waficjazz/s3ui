'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RbacRule } from '@/lib/types';

interface RbacGroupData {
  id: number;
  groupName: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

interface GroupOption {
  id: number;
  groupName: string;
  isAdmin: boolean;
}

export default function AdminRbacPage() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [rules, setRules] = useState<RbacRule[]>([]);
  const [groups, setGroups] = useState<RbacGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showAdminGroupDialog, setShowAdminGroupDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<RbacRule | null>(null);

  // Form states for rules
  const [formData, setFormData] = useState({
    bucketName: '',
    path: '',
    accessType: 'READ' as 'READ' | 'WRITE',
    includeSubfolders: true,
    description: '',
    groupIds: [] as number[],
    newGroupName: '',
  });

  // Form states for admin groups
  const [adminGroupForm, setAdminGroupForm] = useState({
    newAdminGroupName: '',
    selectedExistingGroup: '',
    selectedGroupToDemote: '',
  });

  // Check if user is admin
  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      redirect('/auth/login');
    }

    const userIsAdmin = (session.user as any).isAdmin;
    setIsAdmin(userIsAdmin);

    if (!userIsAdmin) {
      redirect('/');
    }
  }, [session, status]);

  // Fetch RBAC rules and groups
  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch rules
        const rulesResponse = await fetch('/api/rbac/rules');
        if (!rulesResponse.ok) {
          throw new Error(`Failed to fetch rules: ${rulesResponse.statusText}`);
        }
        const rulesData = await rulesResponse.json();
        if (!rulesData.success) {
          throw new Error(rulesData.message || 'Failed to fetch RBAC rules');
        }
        setRules(rulesData.data || []);

        // Fetch groups
        const groupsResponse = await fetch('/api/rbac/groups');
        if (!groupsResponse.ok) {
          throw new Error(`Failed to fetch groups: ${groupsResponse.statusText}`);
        }
        const groupsData = await groupsResponse.json();
        if (!groupsData.success) {
          throw new Error(groupsData.message || 'Failed to fetch groups');
        }
        setGroups(groupsData.data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        console.error('[RBAC Admin] Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  // Rule form handlers
  const resetRuleForm = () => {
    setFormData({
      bucketName: '',
      path: '',
      accessType: 'READ',
      includeSubfolders: true,
      description: '',
      groupIds: [],
      newGroupName: '',
    });
    setEditingRule(null);
  };

  const openCreateRuleDialog = () => {
    resetRuleForm();
    setShowRuleDialog(true);
  };

  const openEditRuleDialog = (rule: RbacRule) => {
    setEditingRule(rule);
    setFormData({
      bucketName: rule.bucketName,
      path: rule.path || '',
      accessType: rule.accessType,
      includeSubfolders: rule.includeSubfolders,
      description: rule.description || '',
      groupIds: rule.groups.map((rg) => rg.groupId),
      newGroupName: '',
    });
    setShowRuleDialog(true);
  };

  const addGroupToRule = (groupId: number) => {
    if (formData.groupIds.includes(groupId)) {
      setError('Group already added');
      return;
    }

    setFormData({
      ...formData,
      groupIds: [...formData.groupIds, groupId],
    });

    setError(null);
  };

  const removeGroupFromRule = (groupId: number) => {
    setFormData({
      ...formData,
      groupIds: formData.groupIds.filter((id) => id !== groupId),
    });
  };

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.bucketName.trim()) {
      setError('Bucket name is required');
      return;
    }

    // If there's a new group name, create it first
    let groupIdsToSubmit = [...formData.groupIds];
    if (formData.newGroupName.trim()) {
      if (groups.some((g) => g.groupName === formData.newGroupName)) {
        setError('Group name already exists');
        return;
      }

      try {
        const response = await fetch('/api/rbac/groups', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupName: formData.newGroupName,
            isAdmin: false,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to create group');
        }

        // Add the new group to the groups list
        groupIdsToSubmit.push(data.data.id);

        // Refresh groups
        const groupsResponse = await fetch('/api/rbac/groups');
        const groupsData = await groupsResponse.json();
        if (groupsData.success) {
          setGroups(groupsData.data || []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        console.error('[RBAC] Error creating group:', err);
        return;
      }
    }

    if (groupIdsToSubmit.length === 0) {
      setError('At least one group must be added');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = editingRule ? `/api/rbac/rules?id=${editingRule.id}` : '/api/rbac/rules';
      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketName: formData.bucketName,
          path: formData.path || null,
          accessType: formData.accessType,
          includeSubfolders: formData.includeSubfolders,
          description: formData.description || null,
          groupIds: groupIdsToSubmit,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to ${editingRule ? 'update' : 'create'} rule`);
      }

      // Refresh rules
      const rulesResponse = await fetch('/api/rbac/rules');
      const rulesData = await rulesResponse.json();
      if (rulesData.success) {
        setRules(rulesData.data || []);
      }

      setShowRuleDialog(false);
      resetRuleForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[RBAC] Error saving rule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/rbac/rules?id=${ruleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete rule');
      }

      // Refresh rules
      const rulesResponse = await fetch('/api/rbac/rules');
      const rulesData = await rulesResponse.json();
      if (rulesData.success) {
        setRules(rulesData.data || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[RBAC] Error deleting rule:', err);
    } finally {
      setLoading(false);
    }
  };

  // Admin groups handlers
  const createNewAdminGroup = async () => {
    if (!adminGroupForm.newAdminGroupName.trim()) {
      setError('Group name cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create a new group with admin privileges
      const response = await fetch('/api/rbac/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupName: adminGroupForm.newAdminGroupName,
          isAdmin: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create admin group');
      }

      // Refresh groups
      const groupsResponse = await fetch('/api/rbac/groups');
      const groupsData = await groupsResponse.json();
      if (groupsData.success) {
        setGroups(groupsData.data || []);
      }

      setAdminGroupForm({ newAdminGroupName: '', selectedExistingGroup: '', selectedGroupToDemote: '' });
      setShowAdminGroupDialog(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[RBAC] Error creating admin group:', err);
    } finally {
      setLoading(false);
    }
  };

  const promoteGroupToAdmin = async () => {
    if (!adminGroupForm.selectedExistingGroup.trim()) {
      setError('Please select a group');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Find the group ID
      const group = groups.find((g) => g.groupName === adminGroupForm.selectedExistingGroup);
      if (!group) {
        throw new Error('Group not found');
      }

      // Update group to admin
      const response = await fetch(`/api/rbac/groups?id=${group.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isAdmin: true,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update group admin status');
      }

      // Refresh groups
      const groupsResponse = await fetch('/api/rbac/groups');
      const groupsData = await groupsResponse.json();
      if (groupsData.success) {
        setGroups(groupsData.data || []);
      }

      setAdminGroupForm({ newAdminGroupName: '', selectedExistingGroup: '', selectedGroupToDemote: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[RBAC] Error promoting group:', err);
    } finally {
      setLoading(false);
    }
  };

  const demoteGroupFromAdmin = async () => {
    if (!adminGroupForm.selectedGroupToDemote.trim()) {
      setError('Please select a group to demote');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Find the group ID
      const group = groups.find((g) => g.groupName === adminGroupForm.selectedGroupToDemote);
      if (!group) {
        throw new Error('Group not found');
      }

      // Update group to remove admin status
      const response = await fetch(`/api/rbac/groups?id=${group.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isAdmin: false,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove admin status');
      }

      // Refresh groups
      const groupsResponse = await fetch('/api/rbac/groups');
      const groupsData = await groupsResponse.json();
      if (groupsData.success) {
        setGroups(groupsData.data || []);
      }

      setAdminGroupForm({ newAdminGroupName: '', selectedExistingGroup: '', selectedGroupToDemote: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[RBAC] Error demoting group:', err);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">RBAC Administration</h1>
              <p className="text-gray-600 mt-2">Manage access rules and groups for S3 resources</p>
            </div>
            <Link href="/">
              <Button variant="outline">Back to Browser</Button>
            </Link>
          </div>
        </div>

        {error && (
          <Card className="bg-red-50 border-red-200 p-4">
            <p className="text-red-800">
              <span className="font-semibold">Error:</span> {error}
            </p>
          </Card>
        )}

        {loading && !showRuleDialog && !showAdminGroupDialog ? (
          <Card className="p-8 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          </Card>
        ) : (
          <>
            {/* Admin Groups Section */}
            <Card className="bg-white shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Admin Groups</h2>
                    <p className="text-gray-600 text-sm mt-1">
                      Manage which groups have administrator privileges ({groups.filter((g) => g.isAdmin).length})
                    </p>
                  </div>
                  <Button onClick={() => setShowAdminGroupDialog(true)} className="bg-amber-600 hover:bg-amber-700">
                    Manage Admin Groups
                  </Button>
                </div>
              </div>

              <div className="p-6">
                {groups.filter((g) => g.isAdmin).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No admin groups configured</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Group Name</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groups
                          .filter((g) => g.isAdmin)
                          .map((group) => (
                            <TableRow key={group.id}>
                              <TableCell className="font-medium">{group.groupName}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      setLoading(true);
                                      setError(null);

                                      const response = await fetch(`/api/rbac/groups?id=${group.id}`, {
                                        method: 'PUT',
                                        headers: {
                                          'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                          isAdmin: false,
                                        }),
                                      });

                                      const data = await response.json();
                                      if (!response.ok || !data.success) {
                                        throw new Error(data.message || 'Failed to remove admin status');
                                      }

                                      // Refresh groups
                                      const groupsResponse = await fetch('/api/rbac/groups');
                                      const groupsData = await groupsResponse.json();
                                      if (groupsData.success) {
                                        setGroups(groupsData.data || []);
                                      }
                                    } catch (err) {
                                      const message = err instanceof Error ? err.message : 'An error occurred';
                                      setError(message);
                                      console.error('[RBAC] Error removing admin status:', err);
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  Remove Admin
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </Card>

            {/* RBAC Rules Section */}
            <Card className="bg-white shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Access Rules</h2>
                    <p className="text-gray-600 text-sm mt-1">Configure who can access which S3 resources ({rules.length})</p>
                  </div>
                  <Button onClick={openCreateRuleDialog} className="bg-blue-600 hover:bg-blue-700">
                    + Create Rule
                  </Button>
                </div>
              </div>

              <div className="p-6">
                {rules.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No rules found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bucket</TableHead>
                          <TableHead>Path</TableHead>
                          <TableHead>Access</TableHead>
                          <TableHead>Subfolders</TableHead>
                          <TableHead>Groups</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="font-medium">{rule.bucketName}</TableCell>
                            <TableCell>{rule.path || '/'}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  rule.accessType === 'WRITE'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }
                              >
                                {rule.accessType}
                              </Badge>
                            </TableCell>
                            <TableCell>{rule.includeSubfolders ? 'Yes' : 'No'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {rule.groups.map((rg) => {
                                  const group = groups.find((g) => g.id === rg.groupId);
                                  return (
                                    <Badge
                                      key={rg.id}
                                      className={
                                        group?.isAdmin
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }
                                    >
                                      {group?.groupName}
                                      {group?.isAdmin && ' ⭐'}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditRuleDialog(rule)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteRule(rule.id)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}

        {/* Create/Edit Rule Dialog */}
        <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
              <DialogDescription>
                {editingRule
                  ? 'Update the access rule details'
                  : 'Define which groups can access which S3 resources'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleRuleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bucket Name *
                  </label>
                  <Input
                    value={formData.bucketName}
                    onChange={(e) =>
                      setFormData({ ...formData, bucketName: e.target.value })
                    }
                    placeholder="e.g., my-bucket"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Path (optional)
                  </label>
                  <Input
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    placeholder="e.g., /folder1/subfolder"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Type *
                  </label>
                  <select
                    value={formData.accessType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        accessType: e.target.value as 'READ' | 'WRITE',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="READ">READ</option>
                    <option value="WRITE">WRITE</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includeSubfolders}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          includeSubfolders: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Include Subfolders
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="e.g., Dev team access to project files"
                />
              </div>

              {/* Groups Section */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Groups * (Type a new group name or select existing)
                </label>

                {/* New Group Input */}
                <div className="space-y-3 mb-4">
                  <Input
                    value={formData.newGroupName}
                    onChange={(e) =>
                      setFormData({ ...formData, newGroupName: e.target.value })
                    }
                    placeholder="Type new group name (e.g., dev-team) or leave empty to select existing"
                  />
                </div>

                {/* Select Group Dropdown */}
                <div className="space-y-3 mb-4">
                  <select
                    onChange={(e) => {
                      const groupId = parseInt(e.target.value);
                      if (groupId) {
                        addGroupToRule(groupId);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an existing group to add...</option>
                    {groups
                      .filter((g) => !formData.groupIds.includes(g.id))
                      .map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.groupName} {group.isAdmin && '⭐ (Admin)'}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Selected Groups */}
                {formData.groupIds.length > 0 ? (
                  <div className="space-y-2">
                    {formData.groupIds.map((groupId) => {
                      const group = groups.find((g) => g.id === groupId);
                      if (!group) return null;
                      return (
                        <div
                          key={groupId}
                          className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {group.groupName}
                            </span>
                            {group.isAdmin && (
                              <Badge className="bg-amber-100 text-amber-800">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeGroupFromRule(groupId)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No groups added yet
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRuleDialog(false);
                    resetRuleForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Admin Groups Dialog */}
        <Dialog open={showAdminGroupDialog} onOpenChange={setShowAdminGroupDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Admin Groups</DialogTitle>
              <DialogDescription>
                Create new admin groups or promote existing groups to admin status
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Create New Admin Group */}
              <div className="border-b pb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Create New Admin Group</h3>
                <div className="space-y-3">
                  <Input
                    value={adminGroupForm.newAdminGroupName}
                    onChange={(e) =>
                      setAdminGroupForm({
                        ...adminGroupForm,
                        newAdminGroupName: e.target.value,
                      })
                    }
                    placeholder="New group name (e.g., super-admins)"
                  />
                  <Button
                    onClick={createNewAdminGroup}
                    className="w-full bg-amber-600 hover:bg-amber-700"
                  >
                    Create Admin Group
                  </Button>
                </div>
              </div>

              {/* Promote Existing Group */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Promote Existing Group</h3>
                <div className="space-y-3">
                  <select
                    value={adminGroupForm.selectedExistingGroup}
                    onChange={(e) =>
                      setAdminGroupForm({
                        ...adminGroupForm,
                        selectedExistingGroup: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a group to promote...</option>
                    {groups
                      .filter((g) => !g.isAdmin)
                      .map((group) => (
                        <option key={group.groupName} value={group.groupName}>
                          {group.groupName}
                        </option>
                      ))}
                  </select>
                  <Button
                    onClick={promoteGroupToAdmin}
                    variant="outline"
                    className="w-full"
                  >
                    Promote to Admin
                  </Button>
                </div>
              </div>

              <div className="flex justify-end border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAdminGroupDialog(false);
                    setAdminGroupForm({ newAdminGroupName: '', selectedExistingGroup: '', selectedGroupToDemote: '' });
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
