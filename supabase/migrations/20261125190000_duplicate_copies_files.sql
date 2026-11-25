-- 20261125190000_duplicate_copies_files.sql — a duplicated order gets its own file rows
--
-- TRANSACTION_RECORD.md (the failure WP3 found and WP4 left: "a copied product
-- that links a file still fails"). duplicate_order copied a product's file
-- links with the source order's file ids. A file row belongs to one order, and
-- trg_product_file_order_check refuses a product's link to a file of another
-- order, so duplicating an order whose product had a file failed, the whole
-- copy with it. A textile design's file_id is not checked, so a copied design
-- pointed at the source order's file.
--
-- The copy now gets a file row of its own for every file its products use:
--
-- | Step                          | What it writes                              |
-- |-------------------------------|---------------------------------------------|
-- | one row per file used by the  | `files` on the new order: the same name,    |
-- | selected products (a link or  | path, role and thumbnail path; version 1,   |
-- | a textile design's file)      | no replaces_file_id                         |
-- | each copied product's links   | `product_files` onto the copy's own rows    |
-- | each copied textile design    | `file_id` onto the copy's own row           |
--
-- A file row is a link to the network share: both rows name the same path and
-- nothing is copied on disk. A file of the source order that none of the
-- selected products uses is not copied.
--
-- The record follows without a change to it: the files trigger writes a
-- FILE_ADDED for each new row and the product_files trigger one per link, as
-- they do for a file linked by hand, under the copy's one action id.
--
-- The function's signature, owner and grants stay as 20261120114018_product_save
-- left them; only its body changes.

/**
 * Clone an existing order into a new quote. The whole function body runs as
 * a single transaction, so any failure rolls the entire clone back.
 *
 * Copies the source order's customer into a new order with status QUOTE, then
 * gives the copy a file row of its own for every file the selected products
 * use, and clones each selected product (status reset to IN_SETUP, unassigned,
 * a fresh product_number from the trigger), its typed child, its product_files
 * links onto the copy's file rows and, for TEXTILE, the batch's garment lines
 * and designs. A copy is a new order and is recorded as one: the orders
 * trigger writes ORDER_CREATED, the files trigger a FILE_ADDED per copied
 * file, the product_files trigger a FILE_ADDED per copied link, and this
 * function a PRODUCT_CREATED per copied product, all under one action id.
 * SECURITY DEFINER.
 *
 * @param source_order_id      order to clone
 * @param new_priority         priority for the new order
 * @param new_delivery         delivery type for the new order
 * @param new_deadline         deadline for the new order
 * @param selected_product_ids which of the source products to copy
 * @returns the new order's id
 */
CREATE OR REPLACE FUNCTION "public"."duplicate_order"("source_order_id" "uuid", "new_priority" "public"."priority_type", "new_delivery" "public"."delivery_type", "new_deadline" "date", "selected_product_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  source_customer_id    UUID;
  source_payment        public.payment_method;
  new_order_id          UUID;
  new_product_id        UUID;
  source_product        RECORD;
  source_file           RECORD;
  new_file_id           UUID;
  -- The source order's file id → the id of its row on the copy.
  copied_files          JSONB := '{}'::jsonb;
BEGIN
  -- Customer + payment method of the source order
  SELECT customer_id, payment_method INTO source_customer_id, source_payment FROM orders WHERE id = source_order_id;
  IF source_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id missing on source order';
  END IF;

  -- New order
  INSERT INTO orders (customer_id, status, priority, delivery, deadline, payment_method)
  VALUES (source_customer_id, 'QUOTE', new_priority, new_delivery, new_deadline, source_payment)
  RETURNING id INTO new_order_id;

  -- The files the copied products use, each as a row of its own on the copy:
  -- same name, path and role. A file row is a link to the network share, so
  -- nothing is copied on disk. The version chain is not carried over; the
  -- copy's row is a first version.
  FOR source_file IN
    SELECT f.id, f.display_name, f.path, f.role, f.thumbnail_path
    FROM files f
    WHERE f.id IN (
      SELECT pf.file_id FROM product_files pf WHERE pf.product_id = ANY(selected_product_ids)
      UNION
      SELECT d.file_id FROM textile_designs d
      WHERE d.product_id = ANY(selected_product_ids) AND d.file_id IS NOT NULL
    )
    ORDER BY f.created_at, f.id
  LOOP
    INSERT INTO files (order_id, display_name, path, role, thumbnail_path)
    VALUES (new_order_id, source_file.display_name, source_file.path, source_file.role, source_file.thumbnail_path)
    RETURNING id INTO new_file_id;

    copied_files := copied_files || jsonb_build_object(source_file.id::text, new_file_id);
  END LOOP;

  -- Products (every department). Workflow state is not carried over: the copy
  -- starts in setup, unassigned, with no approval and its own number.
  FOR source_product IN
    SELECT * FROM products WHERE id = ANY(selected_product_ids) ORDER BY sort_order
  LOOP
        INSERT INTO products (order_id, department, type, status, quantity, notes, priority, delivery, sort_order)
        VALUES (new_order_id, source_product.department, source_product.type, 'IN_SETUP', source_product.quantity, source_product.notes, source_product.priority, source_product.delivery, source_product.sort_order)
        RETURNING id INTO new_product_id;

        -- Copy the typed child row (one arm per product type)
        CASE source_product.type
          WHEN 'POSTER' THEN
            INSERT INTO poster_products (product_id, format, width, height, material, laminate)
            SELECT new_product_id, format, width, height, material, laminate FROM poster_products WHERE product_id = source_product.id;
          WHEN 'CARD_FLYER' THEN
            INSERT INTO card_flyer_products (product_id, format, width, height, color_mode, full_bleed, production_path, cc_material, cc_material_other, offset_type, offset_weight, offset_finish, special_paper, special_paper_other, lamination_finish, lamination_sides, recycling_weight)
            SELECT new_product_id, format, width, height, color_mode, full_bleed, production_path, cc_material, cc_material_other, offset_type, offset_weight, offset_finish, special_paper, special_paper_other, lamination_finish, lamination_sides, recycling_weight FROM card_flyer_products WHERE product_id = source_product.id;
          WHEN 'FOLDED_FLYER' THEN
            INSERT INTO folded_flyer_products (product_id, format, width, height, color_mode, full_bleed, production_path, cc_material, cc_material_other, offset_type, offset_weight, offset_finish, special_paper, special_paper_other, lamination_finish, lamination_sides, recycling_weight, fold_type, page_count)
            SELECT new_product_id, format, width, height, color_mode, full_bleed, production_path, cc_material, cc_material_other, offset_type, offset_weight, offset_finish, special_paper, special_paper_other, lamination_finish, lamination_sides, recycling_weight, fold_type, page_count FROM folded_flyer_products WHERE product_id = source_product.id;
          WHEN 'BROCHURE' THEN
            INSERT INTO brochure_products (product_id, format, width, height, orientation, page_count, full_bleed, production_path, cover_material, cover_material_other, inner_material, inner_material_other, binding, cover_weight, cover_finish, inner_weight, inner_finish)
            SELECT new_product_id, format, width, height, orientation, page_count, full_bleed, production_path, cover_material, cover_material_other, inner_material, inner_material_other, binding, cover_weight, cover_finish, inner_weight, inner_finish FROM brochure_products WHERE product_id = source_product.id;
          WHEN 'BUSINESS_CARD' THEN
            INSERT INTO business_card_products (product_id, format, width, height, orientation, color_mode, material, film_laminated, multiloft_color, full_bleed)
            SELECT new_product_id, format, width, height, orientation, color_mode, material, film_laminated, multiloft_color, full_bleed FROM business_card_products WHERE product_id = source_product.id;
          WHEN 'BINDING' THEN
            INSERT INTO binding_products (product_id, format, width, height, orientation, material, material_other, color_mode, binding_type, binding_color, full_bleed, hardcover_print, hardcover_cover)
            SELECT new_product_id, format, width, height, orientation, material, material_other, color_mode, binding_type, binding_color, full_bleed, hardcover_print, hardcover_cover FROM binding_products WHERE product_id = source_product.id;
          WHEN 'PRINTOUT' THEN
            INSERT INTO printout_products (product_id, format, material, material_other, color_mode, punching, staple, laminate)
            SELECT new_product_id, format, material, material_other, color_mode, punching, staple, laminate FROM printout_products WHERE product_id = source_product.id;
          WHEN 'TRODAT_PRINTY' THEN
            INSERT INTO trodat_printy_products (product_id, model_id)
            SELECT new_product_id, model_id FROM trodat_printy_products WHERE product_id = source_product.id;
          WHEN 'WOODEN_STAMP' THEN
            INSERT INTO wooden_stamp_products (product_id, model_id)
            SELECT new_product_id, model_id FROM wooden_stamp_products WHERE product_id = source_product.id;
          WHEN 'STAND_STAMP' THEN
            INSERT INTO stand_stamp_products (product_id, width, height, color, color_other, description)
            SELECT new_product_id, width, height, color, color_other, description FROM stand_stamp_products WHERE product_id = source_product.id;
          WHEN 'DATE_STAMP' THEN
            INSERT INTO date_stamp_products (product_id, width, height, color, color_other, description)
            SELECT new_product_id, width, height, color, color_other, description FROM date_stamp_products WHERE product_id = source_product.id;
          WHEN 'OTHER_STAMP' THEN
            INSERT INTO other_stamp_products (product_id, width, height, color, color_other, description)
            SELECT new_product_id, width, height, color, color_other, description FROM other_stamp_products WHERE product_id = source_product.id;
          WHEN 'STAMP_PLATE' THEN
            INSERT INTO stamp_plate_products (product_id, width, height)
            SELECT new_product_id, width, height FROM stamp_plate_products WHERE product_id = source_product.id;
          WHEN 'REFILL_INK' THEN
            INSERT INTO refill_ink_products (product_id, color, ink_type)
            SELECT new_product_id, color, ink_type FROM refill_ink_products WHERE product_id = source_product.id;
          WHEN 'INK_PAD' THEN
            INSERT INTO ink_pad_products (product_id, pad_size, color)
            SELECT new_product_id, pad_size, color FROM ink_pad_products WHERE product_id = source_product.id;
          WHEN 'TRODAT_PAD' THEN
            INSERT INTO trodat_pad_products (product_id, pad_article_number, pad_variant_id, color)
            SELECT new_product_id, pad_article_number, pad_variant_id, color FROM trodat_pad_products WHERE product_id = source_product.id;
          WHEN 'STICKER' THEN
            INSERT INTO sticker_products (product_id, material, material_variant, contour_cut, laminate, output, width, height)
            SELECT new_product_id, material, material_variant, contour_cut, laminate, output, width, height FROM sticker_products WHERE product_id = source_product.id;
          WHEN 'SIGN_UV' THEN
            INSERT INTO sign_uv_products (product_id, material, print_side, acrylic_print_direction, width, height, round_corners, drill_holes, drill_hole_diameter, drill_hole_position)
            SELECT new_product_id, material, print_side, acrylic_print_direction, width, height, round_corners, drill_holes, drill_hole_diameter, drill_hole_position FROM sign_uv_products WHERE product_id = source_product.id;
          WHEN 'SIGN_FOIL' THEN
            INSERT INTO sign_foil_products (product_id, material, laminate, print_side, width, height, round_corners, drill_holes, drill_hole_diameter, drill_hole_position)
            SELECT new_product_id, material, laminate, print_side, width, height, round_corners, drill_holes, drill_hole_diameter, drill_hole_position FROM sign_foil_products WHERE product_id = source_product.id;
          WHEN 'FOIL_PLOTTER' THEN
            INSERT INTO foil_plotter_products (product_id, material, output, width, height)
            SELECT new_product_id, material, output, width, height FROM foil_plotter_products WHERE product_id = source_product.id;
          WHEN 'BANNER' THEN
            INSERT INTO banner_products (product_id, material, width, height, hem, hem_sides, eyelets, eyelet_detail)
            SELECT new_product_id, material, width, height, hem, hem_sides, eyelets, eyelet_detail FROM banner_products WHERE product_id = source_product.id;
          WHEN 'ROLLUP' THEN
            INSERT INTO rollup_products (product_id, material, rollup_system, rollup_width)
            SELECT new_product_id, material, rollup_system, rollup_width FROM rollup_products WHERE product_id = source_product.id;
          WHEN 'VEHICLE_LETTERING' THEN
            INSERT INTO vehicle_lettering_products (product_id, vehicle_make, vehicle_model, area_sides, area_front, area_rear, installation, existing_wrap, installation_date)
            SELECT new_product_id, vehicle_make, vehicle_model, area_sides, area_front, area_rear, installation, existing_wrap, installation_date FROM vehicle_lettering_products WHERE product_id = source_product.id;
          WHEN 'OTHER_LFP' THEN
            INSERT INTO other_lfp_products (product_id, description)
            SELECT new_product_id, description FROM other_lfp_products WHERE product_id = source_product.id;
          WHEN 'SIGN' THEN
            INSERT INTO sign_products (product_id, motif, material, material_other, width, height, round_corners, self_adhesive)
            SELECT new_product_id, motif, material, material_other, width, height, round_corners, self_adhesive FROM sign_products WHERE product_id = source_product.id;
          WHEN 'TROPHY_PLATE' THEN
            INSERT INTO trophy_plate_products (product_id, motif, material, material_other, width, height, round_corners, self_adhesive)
            SELECT new_product_id, motif, material, material_other, width, height, round_corners, self_adhesive FROM trophy_plate_products WHERE product_id = source_product.id;
          WHEN 'NAME_TAG' THEN
            INSERT INTO name_tag_products (product_id, motif, material, material_other, width, height, round_corners)
            SELECT new_product_id, motif, material, material_other, width, height, round_corners FROM name_tag_products WHERE product_id = source_product.id;
          WHEN 'GIFT_ITEM' THEN
            INSERT INTO gift_item_products (product_id, motif, material_free_text, origin)
            SELECT new_product_id, motif, material_free_text, origin FROM gift_item_products WHERE product_id = source_product.id;
          WHEN 'OTHER_LASER' THEN
            INSERT INTO other_laser_products (product_id, motif, material_free_text, origin, self_adhesive)
            SELECT new_product_id, motif, material_free_text, origin, self_adhesive FROM other_laser_products WHERE product_id = source_product.id;
          WHEN 'OTHER' THEN
            INSERT INTO other_products (product_id, description)
            SELECT new_product_id, description FROM other_products WHERE product_id = source_product.id;
          WHEN 'TEXTILE_GARMENT' THEN
            -- No 1:1 child: a textile batch's garment lines and designs are
            -- 1:n and are copied after this CASE.
            NULL;
        END CASE;

        -- Link the copy to the copy's own file rows
        INSERT INTO product_files (product_id, file_id)
        SELECT new_product_id, (copied_files ->> file_id::text)::uuid
        FROM product_files
        WHERE product_id = source_product.id;

        -- TEXTILE: the batch's garment lines and its designs, both per product.
        IF source_product.type = 'TEXTILE_GARMENT' THEN
          INSERT INTO textile_garments (product_id, origin, variant_id, garment_type, brand, model, color, size, quantity, sort_order)
          SELECT new_product_id, origin, variant_id, garment_type, brand, model, color, size, quantity, sort_order
          FROM textile_garments
          WHERE product_id = source_product.id;

          INSERT INTO textile_designs (product_id, type, content, color, font_class, font_name, file_id, placement, size, print_method)
          SELECT new_product_id, type, content, color, font_class, font_name, (copied_files ->> file_id::text)::uuid, placement, size, print_method
          FROM textile_designs
          WHERE product_id = source_product.id;
        END IF;

        -- The copy is complete: record it, with its full content.
        PERFORM public.fn_record_product_created(new_product_id);
  END LOOP;

  RETURN new_order_id;
END;
$$;
