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
      rowDeadline: 'orders-sidebar-row-deadline',
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
      /** One per product; `data-product-id`. */
      product: 'duplicate-dialog-product',
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
        deadlineHint: 'order-settings-deadline-hint',
        delivery: 'order-settings-delivery',
        priority: 'order-settings-priority',
        payment: 'order-settings-payment',
      },
      tabs: {
        products: 'order-tab-products',
        history: 'order-tab-history',
      },
      history: {
        root: 'order-history',
        list: 'order-history-list',
        /** One per entry; `data-event-type` = history_event. */
        item: 'order-history-item',
        empty: 'order-history-empty',
      },
    },

    productList: {
      root: 'product-list',
      /** One per department; `data-department` = Department. Opens the add-product dialog for it. */
      addProduct: 'product-list-add-product',
      list: 'product-list-rows',
      empty: 'product-list-empty',
      /** One per product; `data-product-id`, `data-status` = ProductStatus. */
      row: 'product-list-row',
      rowMissingInfo: 'product-list-row-missing-info',
      rowHighPriority: 'product-list-row-high-priority',
      rowDeadlineMissed: 'product-list-row-deadline-missed',
      contextMenu: {
        advance: 'product-context-menu-advance',
        delete: 'product-context-menu-delete',
        cancel: 'product-context-menu-cancel',
      },
      /** The department → type → form dialog that creates a product. */
      addDialog: {
        root: 'add-product-dialog',
        /** One per product type of the chosen department; `data-type`. */
        typeOption: 'add-product-dialog-type-option',
        back: 'add-product-dialog-back',
      },
    },

    productDetail: {
      root: 'product-detail',
      title: 'product-detail-title',
      assignee: 'product-detail-assignee',
      assigneeHint: 'product-detail-assignee-hint',
      /** `data-status` = ProductStatus. */
      status: 'product-detail-status',
      pdfButton: 'product-detail-pdf',
      deleteButton: 'product-detail-delete',
      cancelButton: 'product-detail-cancel',
      release: {
        /** `data-target` = target ProductStatus. */
        button: 'product-release-button',
        menuTrigger: 'product-release-menu-trigger',
        forceItem: 'product-release-force-item',
        dialog: {
          root: 'product-force-release-dialog',
          reason: 'product-force-release-dialog-reason',
          cancel: 'product-force-release-dialog-cancel',
          submit: 'product-force-release-dialog-submit',
        },
      },
      /** `data-kind` = done | shortage | blocked | production. */
      banner: {
        root: 'product-banner',
        backToPrepress: 'product-banner-back-to-prepress',
      },
      tabs: {
        basicInfo: 'product-tab-basic-info',
        timeLogs: 'product-tab-time-logs',
        settings: 'product-tab-settings',
        files: 'product-tab-files',
      },
      /** The Basic info tab: the product's own per-type form, read-only until edited. */
      basicInfo: {
        root: 'product-basic-info',
        edit: 'product-basic-info-edit',
        /** One per form input, whatever the product type; `data-field` = the form field name. */
        field: 'product-basic-info-field',
        submit: 'product-basic-info-submit',
        cancel: 'product-basic-info-cancel',
        /** The textile batch editor: guided garment rows and designs. */
        textile: {
          garments: 'product-basic-info-textile-garments',
          /** One per garment line; the instance is picked by position (the rows carry no stable key). */
          garmentRow: 'product-basic-info-textile-garment-row',
          /** The full-width *Add another garment* button; absent while a row is still being picked. */
          addGarment: 'product-basic-info-textile-add-garment',
          removeGarment: 'product-basic-info-textile-remove-garment',
          /** One quantity input per size of the row's model/colour; `data-variant-id`. */
          sizeQuantity: 'product-basic-info-textile-size-quantity',
          /** Switches a garment row between the catalog cascade and free text. */
          freeTextToggle: 'product-basic-info-textile-free-text-toggle',
          /**
           * One per option of a guided step (brand, model, colour, placement,
           * size); `data-step` names the step, `data-value` the option.
           */
          stepOption: 'product-basic-info-textile-step-option',
          /** A pick already made in a guided step, in the row's trail; `data-step`. Clicking it reopens the step. */
          stepPick: 'product-basic-info-textile-step-pick',
          designs: 'product-basic-info-textile-designs',
          /** One per design; picked by position, like the garment rows. `data-design-type` = FILE | TEXT. */
          designRow: 'product-basic-info-textile-design-row',
          /** The text tab's add button; artwork is applied through the other two tabs. */
          addDesign: 'product-basic-info-textile-add-design',
          removeDesign: 'product-basic-info-textile-remove-design',
          /** The picker's own *Text* tab, the one source that is not a file. */
          pickerTextTab: 'product-basic-info-textile-picker-text-tab',
          /** The text tab's input; Enter or the add button adds the design. */
          pickerText: 'product-basic-info-textile-picker-text',
        },
        /** The Files field of every non-textile form: the picked chips plus the shared picker. */
        files: {
          root: 'product-basic-info-files',
          /** One per picked file; `data-file-id`. */
          chip: 'product-basic-info-files-chip',
          /** Unpicks the chip's file. */
          chipRemove: 'product-basic-info-files-chip-remove',
        },
      },
      settings: {
        root: 'product-settings',
        separateDeadline: 'product-settings-separate-deadline',
        deadline: 'product-settings-deadline',
        separateDelivery: 'product-settings-separate-delivery',
        delivery: 'product-settings-delivery',
        separatePriority: 'product-settings-separate-priority',
        priority: 'product-settings-priority',
        approvalRequired: 'product-settings-approval-required',
        grantApproval: 'product-settings-grant-approval',
        approvalGranted: 'product-settings-approval-granted',
        grantDialog: {
          root: 'grant-approval-dialog',
          addFiles: 'grant-approval-dialog-add',
          /** One per file; `data-file-id`. */
          file: 'grant-approval-dialog-file',
          cancel: 'grant-approval-dialog-cancel',
          submit: 'grant-approval-dialog-submit',
        },
      },
      timeLogs: {
        root: 'time-logs',
        total: 'time-logs-total',
        list: 'time-logs-list',
        empty: 'time-logs-empty',
        /** One per log; `data-log-id`. */
        item: 'time-logs-item',
        itemDelete: 'time-logs-item-delete',
        minutes: 'time-logs-minutes',
        onBehalfOf: 'time-logs-on-behalf-of',
        submit: 'time-logs-submit',
      },
      /** The quick-log widget at the bottom of the Basic info tab (not shown once the product is DONE). */
      quickTimeLog: {
        root: 'quick-time-log',
        /** Carries `data-minutes` = the product's total. */
        total: 'quick-time-log-total',
        minutes: 'quick-time-log-minutes',
        onBehalfOf: 'quick-time-log-on-behalf-of',
        submit: 'quick-time-log-submit',
        /** Switches to the Time logs tab. */
        showAll: 'quick-time-log-show-all',
      },
      /** The order's file links, shown from the product so the production view has them too. */
      files: {
        root: 'order-files',
        addFiles: 'order-files-add',
        error: 'order-files-error',
        list: 'order-files-list',
        /** One per file; `data-file-id`. */
        item: 'order-files-item',
        /** The display name — a static span, or the input while editing. */
        itemName: 'order-files-item-name',
        /** The pencil button that switches the name to its input. */
        itemEditName: 'order-files-item-edit-name',
        itemRole: 'order-files-item-role',
        itemRemove: 'order-files-item-remove',
        itemPath: 'order-files-item-path',
      },
    },
  },

  /** The Production page: the cross-order product feed. */
  production: {
    root: 'production-page',
    /** Main area while no product is selected. */
    placeholder: 'production-placeholder',
    /** Main area with a product selected: the order strip plus the product detail (`orders.productDetail`); `data-order-id`, `data-product-id`. */
    productPanel: {
      root: 'production-product-panel',
      orderNumber: 'production-product-panel-order-number',
      customerName: 'production-product-panel-customer-name',
      openInOrders: 'production-product-panel-open-in-orders',
    },
    sidebar: {
      root: 'production-sidebar',
      /** The assignee combobox trigger; `data-value` = users.id, absent while every product is shown. */
      assigneeFilter: 'production-sidebar-assignee-filter',
      /** The list's "everyone" option (clears the filter). */
      assigneeFilterEveryone: 'production-sidebar-assignee-filter-everyone',
      /** One per user in the list; `data-user-id`. */
      assigneeFilterUser: 'production-sidebar-assignee-filter-user',
      /** States what the feed shows: every product, or the products of the chosen user. */
      assigneeFilterCaption: 'production-sidebar-assignee-filter-caption',
      list: 'production-sidebar-list',
      /** Header above each priority group, shown only while the list holds high-priority products; `data-priority` = HIGH | NORMAL. */
      priorityGroup: 'production-sidebar-priority-group',
      empty: 'production-sidebar-empty',
      /** One per product; `data-product-id`, `data-order-id`, `data-status` = ProductStatus, `data-department`, `data-new` while marked new. */
      row: 'production-sidebar-row',
      /** The "New" pill on a product that entered the list while the page was open and has not been clicked. */
      rowNew: 'production-sidebar-row-new',
      rowMissingInfo: 'production-sidebar-row-missing-info',
      rowDeadlineMissed: 'production-sidebar-row-deadline-missed',
      rowProductNumber: 'production-sidebar-row-product-number',
      rowCustomer: 'production-sidebar-row-customer',
      rowDeadline: 'production-sidebar-row-deadline',
      /** `data-status` = ProductStatus. */
      rowStatus: 'production-sidebar-row-status',
      /** `data-user-id` = assignee, or absent while unassigned. */
      rowAssignee: 'production-sidebar-row-assignee',
    },
  },

  /**
   * The shared file picker: the textile editor's design picker and the Files
   * field of every other product form. A host's own tab (textile's *Text*)
   * carries an ID from that host's group.
   */
  filePicker: {
    root: 'file-picker',
    /** The full-width button the picker folds into once the host holds a file. */
    expand: 'file-picker-expand',
    dropTab: 'file-picker-drop-tab',
    filesTab: 'file-picker-files-tab',
    /** Click to browse, or drop files on it; every file linked is picked. */
    dropZone: 'file-picker-drop-zone',
    /** One per order file on the files tab; `data-file-id`. Disabled once the host has it. */
    file: 'file-picker-file',
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
    /** One per feature line, in the sidebar; `data-line` = the line (e.g. "1.10"). */
    sidebarRow: 'release-notes-sidebar-row',
    /** The selected release's detail pane. */
    detail: 'release-notes-detail',
  },
} as const
