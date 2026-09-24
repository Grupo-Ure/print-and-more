/**
 * The single registry of `data-testid` values, imported by both sides:
 *
 *   component:   <Input data-testid={TEST_IDS.login.email} />
 *   page object: page.getByTestId(TEST_IDS.login.email)
 *
 * Pure constants only — the app bundles this file, so nothing from
 * Playwright, Node or React may be imported here.
 *
 * Shape mirrors the page objects under e2e/pom: page → section → element.
 * Values are kebab-case and prefixed by their path so they are unique in the
 * DOM. Repeated elements (a row per order, a button per department) share one
 * ID and carry the instance key in a data attribute, noted per entry.
 */
export const TEST_IDS = {
  login: {
    root: 'login-form',
    email: 'login-email',
    password: 'login-password',
    submit: 'login-submit',
    google: 'login-google',
    error: 'login-error',
  },

  navbar: {
    root: 'navbar',
    /** One per view; `data-view` = AppView. */
    link: 'navbar-link',
    userMenu: {
      trigger: 'navbar-user-menu-trigger',
      content: 'navbar-user-menu-content',
      name: 'navbar-user-menu-name',
      email: 'navbar-user-menu-email',
      role: 'navbar-user-menu-role',
      profile: 'navbar-user-menu-profile',
      releaseNotes: 'navbar-user-menu-release-notes',
      signOut: 'navbar-user-menu-sign-out',
    },
  },

  /** The app-wide `useConfirm()` dialog. */
  confirmDialog: {
    root: 'confirm-dialog',
    title: 'confirm-dialog-title',
    confirm: 'confirm-dialog-confirm',
    cancel: 'confirm-dialog-cancel',
  },

  toast: {
    container: 'toast-container',
    /** `data-type` = error | success | info. */
    item: 'toast-item',
    close: 'toast-close',
  },

  accessDenied: {
    root: 'access-denied',
    backToOrders: 'access-denied-back-to-orders',
  },

  orders: {
    /** Centre column while no order is selected. */
    welcome: 'orders-welcome',
    releaseHighlights: 'orders-welcome-release-highlights',
    releaseNotesLink: 'orders-welcome-release-notes-link',

    sidebar: {
      root: 'orders-sidebar',
      searchToggle: 'orders-sidebar-search-toggle',
      statusFilterToggle: 'orders-sidebar-status-filter-toggle',
      departmentFilterToggle: 'orders-sidebar-department-filter-toggle',
      deadlineFilterToggle: 'orders-sidebar-deadline-filter-toggle',
      /** Carries `aria-pressed`: on = archived orders listed too. */
      archivedToggle: 'orders-sidebar-archived-toggle',
      searchInput: 'orders-sidebar-search-input',
      clearSearch: 'orders-sidebar-clear-search',
      /** One popover per filter group, each opened by its own header toggle. */
      filters: {
        status: {
          root: 'orders-sidebar-filters-status',
          allStatuses: 'orders-sidebar-filters-status-all',
          /** One per order status; `data-status` = OrderStatus. */
          status: 'orders-sidebar-filters-status-option',
          reset: 'orders-sidebar-filters-status-reset',
        },
        department: {
          root: 'orders-sidebar-filters-department',
          /** One per department; `data-department` = Department. */
          option: 'orders-sidebar-filters-department-option',
          reset: 'orders-sidebar-filters-department-reset',
        },
        deadline: {
          root: 'orders-sidebar-filters-deadline',
          deadlineFrom: 'orders-sidebar-filters-deadline-from',
          deadlineTo: 'orders-sidebar-filters-deadline-to',
          intakeFrom: 'orders-sidebar-filters-intake-from',
          intakeTo: 'orders-sidebar-filters-intake-to',
          reset: 'orders-sidebar-filters-deadline-reset',
        },
      },
      list: 'orders-sidebar-list',
      empty: 'orders-sidebar-empty',
      /** One per order; `data-order-id`. */
      row: 'orders-sidebar-row',
      rowNumber: 'orders-sidebar-row-number',
      rowCustomer: 'orders-sidebar-row-customer',
      rowStatus: 'orders-sidebar-row-status',
      rowMenuTrigger: 'orders-sidebar-row-menu-trigger',
      rowMenuDuplicate: 'orders-sidebar-row-menu-duplicate',
      rowMenuDelete: 'orders-sidebar-row-menu-delete',
      newOrderButton: 'orders-sidebar-new-order',
    },

    newOrderDialog: {
      root: 'new-order-dialog',
      error: 'new-order-dialog-error',
      customerSearch: 'new-order-dialog-customer-search',
      /** One per result; `data-customer-id`. */
      customerOption: 'new-order-dialog-customer-option',
      newCustomer: 'new-order-dialog-new-customer',
      selectedCustomer: 'new-order-dialog-selected-customer',
      editCustomer: 'new-order-dialog-edit-customer',
      changeCustomer: 'new-order-dialog-change-customer',
      cancel: 'new-order-dialog-cancel',
      submit: 'new-order-dialog-submit',
    },

    customerDialog: {
      root: 'customer-dialog',
      error: 'customer-dialog-error',
      name: 'customer-dialog-name',
      email: 'customer-dialog-email',
      phone: 'customer-dialog-phone',
      note: 'customer-dialog-note',
      addressToggle: 'customer-dialog-address-toggle',
      street: 'customer-dialog-street',
      houseNumber: 'customer-dialog-house-number',
      postalCode: 'customer-dialog-postal-code',
      city: 'customer-dialog-city',
      cancel: 'customer-dialog-cancel',
      submit: 'customer-dialog-submit',
    },

    duplicateDialog: {
      root: 'duplicate-dialog',
      selectAll: 'duplicate-dialog-select-all',
      /** One per job; `data-job-id`. */
      job: 'duplicate-dialog-job',
      deadline: 'duplicate-dialog-deadline',
      error: 'duplicate-dialog-error',
      cancel: 'duplicate-dialog-cancel',
      submit: 'duplicate-dialog-submit',
    },

    details: {
      root: 'order-details',
      header: {
        orderNumber: 'order-header-number',
        totalTime: 'order-header-total-time',
        quoteNotice: 'order-header-quote-notice',
        doneNotice: 'order-header-done-notice',
        reopen: 'order-header-reopen',
        /** The single forward lifecycle action; `data-target` = target OrderStatus. */
        lifecycle: 'order-header-lifecycle',
        files: 'order-header-files',
        history: 'order-header-history',
        archive: 'order-header-archive',
        cancel: 'order-header-cancel',
        customerName: 'order-header-customer-name',
        editCustomer: 'order-header-edit-customer',
        customerEmail: 'order-header-customer-email',
        customerPhone: 'order-header-customer-phone',
        customerAddress: 'order-header-customer-address',
        copyOrderNumber: 'order-header-copy-order-number',
        copyCustomerEmail: 'order-header-copy-customer-email',
        copyCustomerPhone: 'order-header-copy-customer-phone',
        copyCustomerAddress: 'order-header-copy-customer-address',
      },
      settings: {
        root: 'order-settings',
        deadline: 'order-settings-deadline',
        /** The deadline's calendar popover; day cells inside carry `data-day` = ISO date (react-day-picker). */
        deadlineCalendar: 'order-settings-deadline-calendar',
        delivery: 'order-settings-delivery',
        priority: 'order-settings-priority',
        payment: 'order-settings-payment',
      },
      filesDialog: {
        root: 'order-files-dialog',
        addFiles: 'order-files-dialog-add',
        error: 'order-files-dialog-error',
        list: 'order-files-dialog-list',
        /** One per file; `data-file-id`. */
        item: 'order-files-dialog-item',
        itemName: 'order-files-dialog-item-name',
        itemRole: 'order-files-dialog-item-role',
        itemRemove: 'order-files-dialog-item-remove',
        itemPath: 'order-files-dialog-item-path',
      },
      historyDialog: {
        root: 'order-history-dialog',
        list: 'order-history-dialog-list',
        /** One per entry; `data-event-type` = history_event. */
        item: 'order-history-dialog-item',
        empty: 'order-history-dialog-empty',
      },
    },

    jobList: {
      root: 'job-list',
      /** One per department; `data-department` = Department. */
      addJob: 'job-list-add-job',
      list: 'job-list-rows',
      empty: 'job-list-empty',
      /** One per job; `data-job-id`, `data-status` = JobStatus. */
      row: 'job-list-row',
      rowMissingInfo: 'job-list-row-missing-info',
      contextMenu: {
        advance: 'job-context-menu-advance',
        delete: 'job-context-menu-delete',
        cancel: 'job-context-menu-cancel',
      },
    },

    jobDetail: {
      root: 'job-detail',
      title: 'job-detail-title',
      assignee: 'job-detail-assignee',
      /** `data-status` = JobStatus. */
      status: 'job-detail-status',
      settingsButton: 'job-detail-settings',
      timeLogsButton: 'job-detail-time-logs',
      pdfButton: 'job-detail-pdf',
      deleteButton: 'job-detail-delete',
      cancelButton: 'job-detail-cancel',
      release: {
        /** `data-target` = target JobStatus. */
        button: 'job-release-button',
        menuTrigger: 'job-release-menu-trigger',
        forceItem: 'job-release-force-item',
        dialog: {
          root: 'job-force-release-dialog',
          reason: 'job-force-release-dialog-reason',
          cancel: 'job-force-release-dialog-cancel',
          submit: 'job-force-release-dialog-submit',
        },
      },
      /** `data-kind` = done | shortage | blocked | production. */
      banner: {
        root: 'job-banner',
        backToPrepress: 'job-banner-back-to-prepress',
      },
      products: {
        root: 'job-products',
        /** The section header's add button (always there while editable). */
        add: 'job-products-add',
        table: 'job-products-table',
        empty: 'job-products-empty',
        /** The add button inside the empty state (only while the job has no product). */
        emptyAdd: 'job-products-empty-add',
        /** One per product; `data-product-id`, `data-type`. */
        row: 'job-products-row',
        rowEdit: 'job-products-row-edit',
        rowDelete: 'job-products-row-delete',
        dialog: {
          root: 'product-dialog',
          /** One per product type; `data-type`. */
          typeOption: 'product-dialog-type-option',
          /** One per form input, whatever the product type; `data-field` = the form field name. */
          field: 'product-dialog-field',
          submit: 'product-dialog-submit',
          cancel: 'product-dialog-cancel',
          back: 'product-dialog-back',
          edit: 'product-dialog-edit',
          close: 'product-dialog-close',
        },
      },
      settingsDialog: {
        root: 'job-settings-dialog',
        separateDeadline: 'job-settings-separate-deadline',
        deadline: 'job-settings-deadline',
        separateDelivery: 'job-settings-separate-delivery',
        delivery: 'job-settings-delivery',
        separatePriority: 'job-settings-separate-priority',
        priority: 'job-settings-priority',
        approvalRequired: 'job-settings-approval-required',
        grantApproval: 'job-settings-grant-approval',
        approvalGranted: 'job-settings-approval-granted',
        grantDialog: {
          root: 'grant-approval-dialog',
          addFiles: 'grant-approval-dialog-add',
          /** One per file; `data-file-id`. */
          file: 'grant-approval-dialog-file',
          cancel: 'grant-approval-dialog-cancel',
          submit: 'grant-approval-dialog-submit',
        },
      },
      timeLogsDialog: {
        root: 'time-logs-dialog',
        total: 'time-logs-dialog-total',
        list: 'time-logs-dialog-list',
        empty: 'time-logs-dialog-empty',
        /** One per log; `data-log-id`. */
        item: 'time-logs-dialog-item',
        itemDelete: 'time-logs-dialog-item-delete',
        minutes: 'time-logs-dialog-minutes',
        onBehalfOf: 'time-logs-dialog-on-behalf-of',
        submit: 'time-logs-dialog-submit',
      },
    },
  },

  /** The Production page: the cross-order job feed. */
  production: {
    root: 'production-page',
    /** Main area while no job is selected. */
    placeholder: 'production-placeholder',
    /** Main area with a job selected: the order strip plus the job detail (`orders.jobDetail`); `data-order-id`, `data-job-id`. */
    jobPanel: {
      root: 'production-job-panel',
      orderNumber: 'production-job-panel-order-number',
      customerName: 'production-job-panel-customer-name',
      openInOrders: 'production-job-panel-open-in-orders',
    },
    sidebar: {
      root: 'production-sidebar',
      /** The assignee combobox trigger; `data-value` = users.id, absent while every job is shown. */
      assigneeFilter: 'production-sidebar-assignee-filter',
      /** The list's "everyone" option (clears the filter). */
      assigneeFilterEveryone: 'production-sidebar-assignee-filter-everyone',
      /** One per user in the list; `data-user-id`. */
      assigneeFilterUser: 'production-sidebar-assignee-filter-user',
      /** States what the feed shows: every job, or the jobs of the chosen user. */
      assigneeFilterCaption: 'production-sidebar-assignee-filter-caption',
      list: 'production-sidebar-list',
      empty: 'production-sidebar-empty',
      /** One per job; `data-job-id`, `data-order-id`, `data-status` = JobStatus, `data-department`. */
      row: 'production-sidebar-row',
      rowJobNumber: 'production-sidebar-row-job-number',
      rowCustomer: 'production-sidebar-row-customer',
      /** `data-status` = JobStatus. */
      rowStatus: 'production-sidebar-row-status',
      /** `data-user-id` = assignee, or absent while unassigned. */
      rowAssignee: 'production-sidebar-row-assignee',
    },
  },

  /** Shared by the stamp and textile stock pages. */
  stock: {
    root: 'stock-page',
    table: {
      root: 'stock-table',
      /** One per row; `data-row-id` = model / variant id. */
      row: 'stock-table-row',
      /** The row's stock figure; `data-stock` = the number shown (available stock on the textile page). */
      rowStock: 'stock-table-row-stock',
      empty: 'stock-table-empty',
    },
    booking: {
      quantity: 'stock-booking-quantity',
      increase: 'stock-booking-increase',
      decrease: 'stock-booking-decrease',
      error: 'stock-booking-error',
    },
    reorderDialog: { root: 'stock-reorder-dialog' },
    movementsButton: 'stock-movements-button',
    movementsDialog: { root: 'stock-movements-dialog' },
  },

  stampStock: {
    newModel: 'stamp-stock-new-model',
    search: 'stamp-stock-search',
    typeFilter: 'stamp-stock-type-filter',
    colourFilter: 'stamp-stock-colour-filter',
    showInactive: 'stamp-stock-show-inactive',
    reorder: 'stamp-stock-reorder',
    rowEdit: 'stamp-stock-row-edit',
    rowToggleActive: 'stamp-stock-row-toggle-active',
    modelDialog: {
      root: 'stamp-model-dialog',
      cancel: 'stamp-model-dialog-cancel',
      save: 'stamp-model-dialog-save',
    },
  },

  textileStock: {
    search: 'textile-stock-search',
    brandFilter: 'textile-stock-brand-filter',
    withSamples: 'textile-stock-with-samples',
    reorder: 'textile-stock-reorder',
    masterData: 'textile-stock-master-data',
    backToStock: 'textile-stock-back-to-stock',
  },

  /** The Settings page (admins): a section sidebar plus the active section. */
  settings: {
    root: 'settings-page',
    /** One per section; `data-section` = SettingsSection, `aria-current="page"` when active. */
    sectionLink: 'settings-section-link',
    userManagement: {
      root: 'user-management',
      create: 'user-management-create',
      table: 'user-management-table',
      /** One per user; `data-user-id`. */
      row: 'user-management-row',
      rowRole: 'user-management-row-role',
      rowRoleBadge: 'user-management-row-role-badge',
      /** The developer switch; `data-state` = checked | unchecked (Radix). */
      rowDeveloper: 'user-management-row-developer',
      rowDelete: 'user-management-row-delete',
      createDialog: {
        root: 'create-account-dialog',
        name: 'create-account-dialog-name',
        email: 'create-account-dialog-email',
        password: 'create-account-dialog-password',
        role: 'create-account-dialog-role',
        cancel: 'create-account-dialog-cancel',
        submit: 'create-account-dialog-submit',
      },
    },
    departments: {
      root: 'department-settings',
      /** One per department; `data-department` = Department. */
      row: 'department-settings-row',
      /** The pre-press default combobox trigger; `data-value` = users.id, absent while unset. */
      rowPrepressAssignee: 'department-settings-row-prepress-assignee',
      /** The production default combobox trigger; `data-value` = users.id, absent while unset. */
      rowProductionAssignee: 'department-settings-row-production-assignee',
      /** A user option in either combobox's list; carries `data-user-id`. */
      rowAssigneeUserOption: 'department-settings-row-assignee-user',
      /** The "Unassigned" option in either combobox's list. */
      rowAssigneeEmptyOption: 'department-settings-row-assignee-unassigned',
    },
  },

  releaseNotesPage: {
    root: 'release-notes-page',
    /** One per release, in the sidebar; `data-tag` = the GitHub tag name (e.g. "v1.9.0"). */
    sidebarRow: 'release-notes-sidebar-row',
    /** The selected release's detail pane. */
    detail: 'release-notes-detail',
  },
} as const
