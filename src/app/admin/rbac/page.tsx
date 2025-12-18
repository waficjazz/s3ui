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

interface RbacRule {
  id: number;
  bucketName: string;
  path: string | null;
  accessType: 'READ' | 'WRITE';
  includeSubfolders: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  createdBy: string | null;
  ruleGroups: Array<{
    id: number;
    groupName: string;
    isAdmin: boolean;
  }>;
}

interface RbacGroup {
  groupName: string;
  isAdmin: boolean;
  count: number;
}

interface GroupOption {
  name: string;
  isAdmin: boolean;
}

export default function AdminRbacPage() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [rules, setRules] = useState<RbacRule[]>([]);
  const [groups, setGroups] = useState<RbacGroup[]>([]);
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
    groupNames: [] as GroupOption[],
    newGroupName: '',
    newGroupIsAdmin: false,
  });

  // Form states for admin groups
  const [adminGroupForm, setAdminGroupForm] = useState({
    newAdminGroupName: '',
    selectedExistingGroup: '',
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

  // Fetch RBAC rules
  useEffect(() => {
    if (!isAdmin) return;

    const fetchRules = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/rbac/rules');

        if (!response.ok) {
          throw new Error(`Failed to fetch rules: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          setRules(data.data || []);
          extractGroups(data.data || []);
        } else {
          setError(data.message || 'Failed to fetch RBAC rules');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        console.error('[RBAC Admin] Error fetching rules:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, [isAdmin]);

  // Extract unique groups from rules
  const extractGroups = (rulesData: RbacRule[]) => {
    const groupMap = new Map<string, { isAdmin: boolean; count: number }>();

    rulesData.forEach((rule) => {
      rule.ruleGroups.forEach((rg) => {
        const existing = groupMap.get(rg.groupName) || { isAdmin: false, count: 0 };
        groupMap.set(rg.groupName, {
          isAdmin: existing.isAdmin || rg.isAdmin,
          count: existing.count + 1,
        });
      });
    });

    const groupsArray: RbacGroup[] = Array.from(groupMap.entries()).map(
      ([groupName, { isAdmin: admin, count }]) => ({
        groupName,
        isAdmin: admin,
        count,
      })
    );

    setGroups(groupsArray.sort((a, b) =>
      b.isAdmin === a.isAdmin ? a.groupName.localeCompare(b.groupName) : b.isAdmin ? 1 : -1
    ));
  };

  // Rule form handlers
  const resetRuleForm = () => {
    setFormData({
      bucketName: '',
      path: '',
      accessType: 'READ',
      includeSubfolders: true,
      description: '',
      groupNames: [],
      newGroupName: '',
      newGroupIsAdmin: false,
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
      groupNames: rule.ruleGroups.map((rg) => ({
        name: rg.groupName,
        isAdmin: rg.isAdmin,
      })),
      newGroupName: '',
      newGroupIsAdmin: false,
    });
    setShowRuleDialog(true);
  };

  const addGroup = () => {
    if (!formData.newGroupName.trim()) {
      setError('Group name cannot be empty');
      return;
    }

    if (formData.groupNames.some((g) => g.name === formData.newGroupName)) {
      setError('Group already added');
      return;
    }

    setFormData({
      ...formData,
      groupNames: [
        ...formData.groupNames,
        {
          name: formData.newGroupName,
          isAdmin: formData.newGroupIsAdmin,
        },
      ],
      newGroupName: '',
      newGroupIsAdmin: false,
    });

    setError(null);
  };

  const removeGroup = (index: number) => {
    setFormData({
      ...formData,
      groupNames: formData.groupNames.filter((_, i) => i !== index),
    });
  };

  const toggleGroupAdmin = (index: number) => {
    const newGroups = [...formData.groupNames];
    newGroups[index].isAdmin = !newGroups[index].isAdmin;
    setFormData({
      ...formData,
      groupNames: newGroups,
    });
  };

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.bucketName.trim()) {
      setError('Bucket name is required');
      return;
    }

    if (formData.groupNames.length === 0) {
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
          groupNames: formData.groupNames,
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
        extractGroups(rulesData.data || []);
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
        extractGroups(rulesData.data || []);
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

      // Create a rule for this admin group with a special marker
      const response = await fetch('/api/rbac/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketName: '__admin__',
          path: null,
          accessType: 'WRITE',
          groupNames: [
            {
              name: adminGroupForm.newAdminGroupName,
              isAdmin: true,
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create admin group');
      }

      // Refresh rules
      const rulesResponse = await fetch('/api/rbac/rules');
      const rulesData = await rulesResponse.json();
      if (rulesData.success) {
        setRules(rulesData.data || []);
        extractGroups(rulesData.data || []);
      }

      setAdminGroupForm({ newAdminGroupName: '', selectedExistingGroup: '' });
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

      // Find all rules with this group and update them
      const rulesWithGroup = rules.filter((rule) =>
        rule.ruleGroups.some((rg) => rg.groupName === adminGroupForm.selectedExistingGroup)
      );

      for (const rule of rulesWithGroup) {
        const updatedGroups = rule.ruleGroups.map((rg) => ({
          name: rg.groupName,
          isAdmin: rg.groupName === adminGroupForm.selectedExistingGroup ? true : rg.isAdmin,
        }));

        const response = await fetch(`/api/rbac/rules?id=${rule.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupNames: updatedGroups,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to update group admin status');
        }
      }

      // Refresh rules
      const rulesResponse = await fetch('/api/rbac/rules');
      const rulesData = await rulesResponse.json();
      if (rulesData.success) {
        setRules(rulesData.data || []);
        extractGroups(rulesData.data || []);
      }

      setAdminGroupForm({ newAdminGroupName: '', selectedExistingGroup: '' });
      setShowAdminGroupDialog(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[RBAC] Error promoting group:', err);
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups
                      .filter((g) => g.isAdmin)
                      .map((group) => (
                        <div
                          key={group.groupName}
                          className="p-4 border border-amber-200 rounded-lg bg-amber-50 hover:bg-amber-100 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{group.groupName}</p>
                              <p className="text-sm text-gray-600 mt-1">
                                Used in {group.count} rule{group.count !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <Badge className="bg-amber-600 text-white">Admin</Badge>
                          </div>
                        </div>
                      ))}
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
                          <TableHead>Created By</TableHead>
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
                                {rule.ruleGroups.map((rg) => (
                                  <Badge
                                    key={rg.id}
                                    className={
                                      rg.isAdmin
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }
                                  >
                                    {rg.groupName}
                                    {rg.isAdmin && ' ⭐'}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{rule.createdBy}</TableCell>
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
                  Groups *
                </label>

                {/* Add Group Form */}
                <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 gap-3">
                    <Input
                      value={formData.newGroupName}
                      onChange={(e) =>
                        setFormData({ ...formData, newGroupName: e.target.value })
                      }
                      placeholder="Group name (e.g., dev-team, admin-group)"
                      onKeyPress={(e) => e.key === 'Enter' && addGroup()}
                    />

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.newGroupIsAdmin}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            newGroupIsAdmin: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Admin Group
                      </span>
                    </label>

                    <Button
                      type="button"
                      onClick={addGroup}
                      variant="outline"
                      size="sm"
                    >
                      Add Group
                    </Button>
                  </div>
                </div>

                {/* Selected Groups */}
                {formData.groupNames.length > 0 ? (
                  <div className="space-y-2">
                    {formData.groupNames.map((group, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {group.name}
                          </span>
                          {group.isAdmin && (
                            <Badge className="bg-amber-100 text-amber-800">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleGroupAdmin(index)}
                            className="text-xs"
                          >
                            {group.isAdmin ? 'Remove Admin' : 'Make Admin'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeGroup(index)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
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
                          {group.groupName} ({group.count} rules)
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
                    setAdminGroupForm({
                      newAdminGroupName: '',
                      selectedExistingGroup: '',
                    });
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
