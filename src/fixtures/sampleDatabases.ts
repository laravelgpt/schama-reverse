export interface SampleDatabase {
  id: string;
  name: string;
  category: string;
  description: string;
  engine: 'mysql' | 'postgresql' | 'sqlite' | 'json';
  tablesCount: number;
  files: {
    name: string;
    content: string;
    type: 'sql' | 'json';
  }[];
}

export const SAMPLE_DATABASES: SampleDatabase[] = [
  {
    id: 'ecommerce_mysql',
    name: 'E-Commerce Platform (Multi-file SQL)',
    category: 'Relational & Junction Tables',
    description: 'MySQL dump featuring users, roles, products, categories, orders, order_items junction, explicit FKs, composite indexes, and INSERT seed data.',
    engine: 'mysql',
    tablesCount: 6,
    files: [
      {
        name: 'users_and_roles.sql',
        type: 'sql',
        content: `
-- SchemaForge Fixture: Users & Roles
CREATE TABLE \`roles\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(50) NOT NULL,
  \`slug\` varchar(50) NOT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`roles_slug_unique\` (\`slug\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO \`roles\` (\`id\`, \`name\`, \`slug\`) VALUES
(1, 'Administrator', 'admin'),
(2, 'Customer', 'customer'),
(3, 'Vendor', 'vendor');

CREATE TABLE \`users\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`role_id\` bigint unsigned NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`email\` varchar(255) NOT NULL,
  \`email_verified_at\` timestamp NULL DEFAULT NULL,
  \`password\` varchar(255) NOT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`users_email_unique\` (\`email\`),
  KEY \`users_role_id_index\` (\`role_id\`),
  CONSTRAINT \`fk_users_role_id\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO \`users\` (\`id\`, \`role_id\`, \`name\`, \`email\`, \`password\`) VALUES
(1, 1, 'John Doe', 'john@schemaforge.dev', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
(2, 2, 'Jane Smith', 'jane@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');
`
      },
      {
        name: 'catalog_and_orders.sql',
        type: 'sql',
        content: `
-- SchemaForge Fixture: Catalog, Orders & Items
CREATE TABLE \`categories\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`parent_id\` bigint unsigned DEFAULT NULL,
  \`name\` varchar(100) NOT NULL,
  \`slug\` varchar(100) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`categories_slug_unique\` (\`slug\`),
  CONSTRAINT \`fk_categories_parent_id\` FOREIGN KEY (\`parent_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`products\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`category_id\` bigint unsigned NOT NULL,
  \`sku\` varchar(64) NOT NULL,
  \`title\` varchar(255) NOT NULL,
  \`price\` decimal(10,2) NOT NULL DEFAULT '0.00',
  \`stock\` int NOT NULL DEFAULT '0',
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`products_sku_unique\` (\`sku\`),
  KEY \`products_category_id_idx\` (\`category_id\`),
  CONSTRAINT \`fk_products_category_id\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`orders\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`user_id\` bigint unsigned NOT NULL,
  \`order_number\` varchar(32) NOT NULL,
  \`status\` varchar(30) NOT NULL DEFAULT 'pending',
  \`total_amount\` decimal(12,2) NOT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`orders_number_unique\` (\`order_number\`),
  KEY \`orders_user_id_idx\` (\`user_id\`),
  CONSTRAINT \`fk_orders_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`order_items\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`order_id\` bigint unsigned NOT NULL,
  \`product_id\` bigint unsigned NOT NULL,
  \`quantity\` int NOT NULL DEFAULT '1',
  \`unit_price\` decimal(10,2) NOT NULL,
  \`subtotal\` decimal(10,2) NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`order_items_order_id_idx\` (\`order_id\`),
  KEY \`order_items_product_id_idx\` (\`product_id\`),
  CONSTRAINT \`fk_order_items_order_id\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_order_items_product_id\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`
      }
    ]
  },
  {
    id: 'saas_postgres',
    name: 'SaaS Multi-Tenant CRM (PostgreSQL)',
    category: 'PostgreSQL & UUID & JSONB',
    description: 'Modern PostgreSQL database with UUID primary keys, tenant partitioning columns, JSONB metadata, and composite unique keys.',
    engine: 'postgresql',
    tablesCount: 5,
    files: [
      {
        name: 'saas_schema.sql',
        type: 'sql',
        content: `
-- PostgreSQL Multi-Tenant Database
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(63) NOT NULL UNIQUE,
    plan VARCHAR(32) NOT NULL DEFAULT 'starter',
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE members (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_members_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_tenant_member_email UNIQUE (tenant_id, email)
);

CREATE TABLE pipelines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_pipelines_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE deals (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    pipeline_id UUID NOT NULL,
    assigned_member_id UUID,
    title VARCHAR(255) NOT NULL,
    value NUMERIC(12,2) DEFAULT 0.00,
    stage VARCHAR(50) NOT NULL,
    closed_at TIMESTAMPTZ,
    CONSTRAINT fk_deals_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_deals_pipeline FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
    CONSTRAINT fk_deals_member FOREIGN KEY (assigned_member_id) REFERENCES members(id) ON DELETE SET NULL
);

CREATE TABLE deal_activities (
    id UUID PRIMARY KEY,
    deal_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    type VARCHAR(32) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_member FOREIGN KEY (actor_id) REFERENCES members(id) ON DELETE CASCADE
);
`
      }
    ]
  },
  {
    id: 'legacy_hospital_sqlite',
    name: 'Legacy Hospital EHR (SQLite / Unenforced FKs)',
    category: 'Legacy & Inferred Relations',
    description: 'A legacy database dump without declared foreign keys, demonstrating SchemaForge’s Level 2 structural inference, naming detection, and health warnings.',
    engine: 'sqlite',
    tablesCount: 4,
    files: [
      {
        name: 'ehr_legacy.sql',
        type: 'sql',
        content: `
-- Legacy Hospital SQLite Dump with missing explicit FKs
CREATE TABLE patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mrn VARCHAR(32) NOT NULL,
    first_name VARCHAR(64) NOT NULL,
    last_name VARCHAR(64) NOT NULL,
    birth_date DATE NOT NULL,
    blood_group VARCHAR(5)
);

CREATE TABLE doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_number VARCHAR(50) NOT NULL,
    name VARCHAR(128) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    phone VARCHAR(25)
);

-- Notice: patient_id and doctor_id are columns without explicit FOREIGN KEY constraints!
CREATE TABLE appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    scheduled_at DATETIME NOT NULL,
    room_number VARCHAR(10),
    status VARCHAR(20) DEFAULT 'scheduled'
);

CREATE TABLE prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    medication_name VARCHAR(150) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    instructions TEXT
);
`
      }
    ]
  },
  {
    id: 'json_analytics',
    name: 'Customer Analytics (JSON Dataset)',
    category: 'JSON Schema Inference',
    description: 'Raw JSON document dataset containing customers, invoices, and payment records for reverse-engineering into relational schema and Laravel models.',
    engine: 'json',
    tablesCount: 3,
    files: [
      {
        name: 'analytics_dump.json',
        type: 'json',
        content: JSON.stringify({
          customers: [
            {
              id: 1,
              name: 'Acme Corp',
              contact_email: 'finance@acme.com',
              country_code: 'US',
              is_enterprise: true,
              annual_recurring_revenue: 120000.50,
              created_at: '2025-01-15T08:30:00Z'
            },
            {
              id: 2,
              name: 'Globex Inc',
              contact_email: 'ops@globex.org',
              country_code: 'CA',
              is_enterprise: false,
              annual_recurring_revenue: 45000.00,
              created_at: '2025-03-22T14:15:00Z'
            }
          ],
          invoices: [
            {
              id: 101,
              customer_id: 1,
              invoice_number: 'INV-2026-001',
              amount: 10000.00,
              status: 'paid',
              due_date: '2026-02-15'
            },
            {
              id: 102,
              customer_id: 2,
              invoice_number: 'INV-2026-002',
              amount: 3750.00,
              status: 'pending',
              due_date: '2026-02-28'
            }
          ],
          payments: [
            {
              id: 5001,
              invoice_id: 101,
              payment_method: 'wire_transfer',
              transaction_reference: 'WT-9923812',
              amount_paid: 10000.00,
              paid_at: '2026-02-10T11:00:00Z'
            }
          ]
        }, null, 2)
      }
    ]
  }
];
