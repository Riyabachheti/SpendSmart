import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/auth/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { getApiErrorMessage } from "@/lib/api-error";

import { budgetQueryKeys } from "../budgets/budget-query-keys";
import { deleteCategory, getCategories } from "../categories/category-api";
import { CategoryIcon } from "../categories/category-icon";
import { categoryQueryKeys } from "../categories/category-query-keys";
import type { Category } from "../categories/category-types";
import { expenseQueryKeys } from "../expenses/expense-query-keys";
import { CategoryFormDialog } from "./category-form-dialog";

const joinedFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function SettingsPage() {
  useDocumentTitle("Settings");

  const { logoutAll, user } = useAuth();
  const userId = user!.id;
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const categories = useQuery({
    queryKey: categoryQueryKeys.all(userId),
    queryFn: getCategories,
    staleTime: 5 * 60_000,
  });
  const systemCategories = useMemo(
    () => categories.data?.filter((category) => category.user_id === null) ?? [],
    [categories.data],
  );
  const customCategories = useMemo(
    () => categories.data?.filter((category) => category.user_id === userId) ?? [],
    [categories.data, userId],
  );

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: async () => {
      setCategoryToDelete(null);
      setDeleteError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all(userId) }),
        queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all(userId) }),
        queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all(userId) }),
      ]);
    },
    onError: (error) => {
      setDeleteError(getApiErrorMessage(error, "The category couldn’t be deleted."));
    },
  });

  function openCreateForm() {
    setSelectedCategory(null);
    setFormOpen(true);
  }

  function openEditForm(category: Category) {
    setSelectedCategory(category);
    setFormOpen(true);
  }

  async function handleLogoutAll() {
    setIsLoggingOutAll(true);
    try {
      await logoutAll();
    } catch {
      // Local credentials and private query data are cleared in all cases.
    }
  }

  return (
    <main id="main-content">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-medium tracking-wide text-berry">Settings</p>
        <h1 className="text-4xl leading-tight sm:text-5xl">Your SpendSmart account.</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Keep your categories useful and your active sessions under control.
        </p>
      </header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.7fr)] lg:gap-20">
        <div className="space-y-14">
          <section aria-labelledby="profile-title">
            <div className="border-b border-foreground pb-3">
              <p className="text-sm text-muted-foreground">Account</p>
              <h2 className="mt-1 text-2xl" id="profile-title">Profile</h2>
            </div>
            <dl className="divide-y divide-border/70">
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="font-medium">{user?.full_name?.trim() || "Not provided"}</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="font-medium">{user?.email}</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="text-sm text-muted-foreground">Member since</dt>
                <dd className="font-medium">{user ? joinedFormatter.format(new Date(user.created_at)) : "—"}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="categories-title">
            <div className="flex items-end justify-between gap-4 border-b border-foreground pb-3">
              <div>
                <p className="text-sm text-muted-foreground">Organization</p>
                <h2 className="mt-1 text-2xl" id="categories-title">Categories</h2>
              </div>
              <Button onClick={openCreateForm} size="sm" variant="outline">
                <Plus aria-hidden="true" />
                New category
              </Button>
            </div>

            {categories.isPending ? <p className="py-8 text-sm text-muted-foreground" role="status">Loading categories…</p> : null}
            {categories.isError ? (
              <div className="py-8">
                <p className="text-sm text-destructive" role="alert">{getApiErrorMessage(categories.error, "Your categories couldn’t be loaded.")}</p>
                <button className="mt-3 cursor-pointer text-sm font-medium text-moss" onClick={() => void categories.refetch()} type="button">Try again</button>
              </div>
            ) : null}

            {customCategories.length > 0 ? (
              <div className="pt-6">
                <h3 className="text-sm font-medium tracking-wide text-berry">Your categories</h3>
                <ul className="mt-2">
                  {customCategories.map((category) => (
                    <li className="flex items-center gap-4 border-b border-border/70 py-4" key={category.id}>
                      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-lg">
                        <CategoryIcon className="size-4" icon={category.icon} />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
                      <Button aria-label={`Edit ${category.name}`} onClick={() => openEditForm(category)} size="icon-sm" variant="ghost"><Pencil aria-hidden="true" /></Button>
                      <Button aria-label={`Delete ${category.name}`} onClick={() => { setDeleteError(null); setCategoryToDelete(category); }} size="icon-sm" variant="ghost"><Trash2 aria-hidden="true" /></Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {categories.isSuccess && customCategories.length === 0 ? (
              <p className="py-6 text-sm leading-6 text-muted-foreground">You have not added any personal categories yet.</p>
            ) : null}

            {systemCategories.length > 0 ? (
              <div className="pt-8">
                <h3 className="text-sm font-medium tracking-wide text-muted-foreground">SpendSmart defaults</h3>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                  {systemCategories.map((category) => (
                    <li className="flex items-center gap-2 text-sm" key={category.id}>
                      <CategoryIcon className="size-4 text-moss" icon={category.icon} />
                      {category.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">Default categories are shared and cannot be edited or deleted.</p>
              </div>
            ) : null}
          </section>
        </div>

        <aside>
          <section aria-labelledby="security-title" className="border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <p className="text-sm font-medium tracking-wide text-berry">Security</p>
            <h2 className="mt-3 text-2xl" id="security-title">Active sessions</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              If you used SpendSmart on a shared or lost device, sign out every session linked to this account.
            </p>
            <Button className="mt-6" onClick={() => setLogoutAllOpen(true)} variant="outline">Log out everywhere</Button>
          </section>
        </aside>
      </div>

      <CategoryFormDialog category={selectedCategory} onOpenChange={setFormOpen} open={formOpen} userId={userId} />

      <Dialog onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setCategoryToDelete(null); }} open={Boolean(categoryToDelete)}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Delete {categoryToDelete?.name}?</DialogTitle>
            <DialogDescription>Existing expenses will become uncategorized. Budgets for this category will be removed.</DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}
          <DialogFooter className="-mx-6 -mb-6 p-6">
            <Button disabled={deleteMutation.isPending} onClick={() => categoryToDelete && deleteMutation.mutate(categoryToDelete.id)} variant="destructive">{deleteMutation.isPending ? "Deleting…" : "Delete category"}</Button>
            <Button disabled={deleteMutation.isPending} onClick={() => setCategoryToDelete(null)} variant="outline">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => { if (!isLoggingOutAll) setLogoutAllOpen(open); }} open={logoutAllOpen}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Log out everywhere?</DialogTitle>
            <DialogDescription>This revokes every refresh session for your account, including this device.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 p-6">
            <Button disabled={isLoggingOutAll} onClick={() => void handleLogoutAll()} variant="destructive">{isLoggingOutAll ? "Logging out…" : "Log out everywhere"}</Button>
            <Button disabled={isLoggingOutAll} onClick={() => setLogoutAllOpen(false)} variant="outline">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
