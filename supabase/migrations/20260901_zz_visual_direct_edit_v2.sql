-- Atomic Direct Edit v2 writes. Every accepted mutation, audit record and the
-- existing publication-outbox trigger share one database transaction.

create or replace function public.is_valid_homepage_visual_settings(
  p_value jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  key text;
  number_value numeric;
begin
  if jsonb_typeof(p_value) <> 'object'
    or not (p_value ?& array[
      'imageFit', 'imagePosition', 'imageZoom', 'imageBrightness',
      'imageContrast', 'imageSaturation', 'imageBlur', 'imageOverlay',
      'titleFontSize', 'titleAlign', 'titleWeight', 'titleLineHeight',
      'bodyFontSize', 'bodyAlign', 'bodyWeight', 'bodyLineHeight'
    ])
    or (p_value - array[
      'imageFit', 'imagePosition', 'imageZoom', 'imageBrightness',
      'imageContrast', 'imageSaturation', 'imageBlur', 'imageOverlay',
      'titleFontSize', 'titleAlign', 'titleWeight', 'titleLineHeight',
      'bodyFontSize', 'bodyAlign', 'bodyWeight', 'bodyLineHeight'
    ]) <> '{}'::jsonb
    or p_value ->> 'imageFit' not in ('cover', 'contain', 'fill')
    or p_value ->> 'imagePosition' not in (
      'top-left', 'top', 'top-right', 'left', 'center', 'right',
      'bottom-left', 'bottom', 'bottom-right'
    )
    or p_value ->> 'titleAlign' not in ('left', 'center', 'right')
    or p_value ->> 'bodyAlign' not in ('left', 'center', 'right')
    or (p_value ->> 'titleWeight')::integer not in (400, 500, 600, 700, 800)
    or (p_value ->> 'bodyWeight')::integer not in (400, 500, 600, 700, 800) then
    return false;
  end if;

  foreach key in array array[
    'imageZoom', 'imageBrightness', 'imageContrast', 'imageSaturation',
    'imageBlur', 'imageOverlay', 'titleFontSize', 'titleWeight',
    'titleLineHeight', 'bodyFontSize', 'bodyWeight', 'bodyLineHeight'
  ] loop
    if jsonb_typeof(p_value -> key) <> 'number' then return false; end if;
  end loop;

  return (p_value ->> 'imageZoom')::numeric between 50 and 200
    and (p_value ->> 'imageBrightness')::numeric between 0 and 200
    and (p_value ->> 'imageContrast')::numeric between 0 and 200
    and (p_value ->> 'imageSaturation')::numeric between 0 and 200
    and (p_value ->> 'imageBlur')::numeric between 0 and 20
    and (p_value ->> 'imageOverlay')::numeric between 0 and 90
    and (p_value ->> 'titleFontSize')::numeric between 20 and 112
    and (p_value ->> 'titleLineHeight')::numeric between 0.8 and 1.6
    and (p_value ->> 'bodyFontSize')::numeric between 12 and 32
    and (p_value ->> 'bodyLineHeight')::numeric between 1 and 2.2;
exception
  when others then return false;
end;
$$;

create or replace function public.save_visual_content_field_v2(
  p_entity_type text,
  p_entity_id uuid,
  p_field text,
  p_value jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  value_text text;
  media_id uuid;
  updated_at_value timestamptz;
  audit_action text;
  publication_type text;
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'visual_edit_forbidden' using errcode = '42501';
  end if;
  if p_entity_id is null or p_expected_updated_at is null then
    raise exception 'visual_edit_invalid' using errcode = '22023';
  end if;
  value_text := case when jsonb_typeof(p_value) = 'string' then p_value #>> '{}' else null end;

  if p_entity_type = 'page' then
    if p_field = 'title' and (value_text is null or char_length(value_text) not between 2 and 180) then
      raise exception 'visual_edit_invalid' using errcode = '22023';
    elsif p_field = 'excerpt' and (value_text is null or char_length(value_text) > 700) then
      raise exception 'visual_edit_invalid' using errcode = '22023';
    elsif p_field not in ('title', 'excerpt') then
      raise exception 'visual_edit_field_forbidden' using errcode = '22023';
    end if;
    if p_field = 'title' then
      update public.pages set title = value_text, updated_by = actor_id
      where id = p_entity_id and status = 'published' and deleted_at is null
        and updated_at = p_expected_updated_at returning updated_at into updated_at_value;
    else
      update public.pages set excerpt = value_text, updated_by = actor_id
      where id = p_entity_id and status = 'published' and deleted_at is null
        and updated_at = p_expected_updated_at returning updated_at into updated_at_value;
    end if;
    audit_action := 'page.visual_field_updated';
    publication_type := 'page';

  elsif p_entity_type = 'navigation-item' then
    if p_field = 'label' and (value_text is null or char_length(value_text) not between 1 and 100) then
      raise exception 'visual_edit_invalid' using errcode = '22023';
    elsif p_field = 'href' and (
      value_text is null or char_length(value_text) > 600 or not (
        value_text ~ '^/[^\\]*$' or value_text ~ '^#[^[:space:]]+$'
        or value_text ~ '^https://'
      )
    ) then raise exception 'visual_edit_invalid' using errcode = '22023';
    elsif p_field not in ('label', 'href') then
      raise exception 'visual_edit_field_forbidden' using errcode = '22023';
    end if;
    if p_field = 'label' then
      update public.navigation_items set label = value_text
      where id = p_entity_id and is_visible and updated_at = p_expected_updated_at
      returning updated_at into updated_at_value;
    else
      update public.navigation_items set href = value_text
      where id = p_entity_id and is_visible and updated_at = p_expected_updated_at
      returning updated_at into updated_at_value;
    end if;
    audit_action := 'navigation.visual_field_updated';
    publication_type := 'navigation_item';

  elsif p_entity_type = 'banner' then
    if p_field in ('title', 'description', 'buttonText') then
      if value_text is null or char_length(value_text) > case p_field
        when 'title' then 240 when 'buttonText' then 120 else 1200 end then
        raise exception 'visual_edit_invalid' using errcode = '22023';
      end if;
    elsif p_field = 'targetUrl' then
      if p_value <> 'null'::jsonb and (
        value_text is null or char_length(value_text) > 600 or not (
          value_text ~ '^/[^\\]*$' or value_text ~ '^https://'
        )
      ) then raise exception 'visual_edit_invalid' using errcode = '22023'; end if;
    elsif p_field in ('desktopMediaId', 'tabletMediaId', 'mobileMediaId') then
      if p_value <> 'null'::jsonb then
        if value_text is null or value_text !~* '^[0-9a-f-]{36}$' then
          raise exception 'visual_edit_invalid' using errcode = '22023';
        end if;
        media_id := value_text::uuid;
        if not exists (
          select 1 from public.media_assets where id = media_id and deleted_at is null
        ) then raise exception 'visual_edit_media_missing' using errcode = '23503'; end if;
      end if;
    else raise exception 'visual_edit_field_forbidden' using errcode = '22023';
    end if;
    update public.banners
    set title = case when p_field = 'title' then value_text else title end,
        description = case when p_field = 'description' then value_text else description end,
        button_text = case when p_field = 'buttonText' then value_text else button_text end,
        target_url = case when p_field = 'targetUrl' then value_text else target_url end,
        desktop_media_id = case when p_field = 'desktopMediaId' then media_id else desktop_media_id end,
        tablet_media_id = case when p_field = 'tabletMediaId' then media_id else tablet_media_id end,
        mobile_media_id = case when p_field = 'mobileMediaId' then media_id else mobile_media_id end,
        updated_by = actor_id
    where id = p_entity_id and is_active and updated_at = p_expected_updated_at
    returning updated_at into updated_at_value;
    audit_action := 'banner.visual_field_updated';
    publication_type := 'banner';

  elsif p_entity_type = 'homepage-block' then
    if p_field in ('title', 'eyebrow', 'description', 'copy', 'buttonText', 'buttonUrl') then
      if value_text is null or char_length(value_text) > case p_field
        when 'title' then 240 when 'eyebrow' then 160
        when 'buttonText' then 120 when 'buttonUrl' then 500 else 2000 end then
        raise exception 'visual_edit_invalid' using errcode = '22023';
      end if;
      if p_field = 'buttonUrl' and value_text <> '' and not (
        value_text ~ '^/[^\\]*$' or value_text ~ '^#[^[:space:]]+$'
        or value_text ~ '^https://' or value_text ~ '^mailto:'
      ) then raise exception 'visual_edit_invalid' using errcode = '22023'; end if;
    elsif p_field = 'backgroundMediaId' then
      if p_value <> 'null'::jsonb then
        if value_text is null or value_text !~* '^[0-9a-f-]{36}$' then
          raise exception 'visual_edit_invalid' using errcode = '22023';
        end if;
        media_id := value_text::uuid;
        if not exists (
          select 1 from public.media_assets where id = media_id and deleted_at is null
        ) then raise exception 'visual_edit_media_missing' using errcode = '23503'; end if;
      end if;
    elsif p_field = 'backgroundStyle' then
      if value_text not in ('light', 'violet', 'orange', 'paper', 'transparent') then
        raise exception 'visual_edit_invalid' using errcode = '22023';
      end if;
    else raise exception 'visual_edit_field_forbidden' using errcode = '22023';
    end if;
    update public.homepage_blocks
    set title = case when p_field = 'title' then value_text else title end,
        settings = case when p_field in (
          'eyebrow', 'description', 'copy', 'buttonText', 'buttonUrl'
        ) then jsonb_set(settings, array[p_field], to_jsonb(value_text), true) else settings end,
        background_media_id = case when p_field = 'backgroundMediaId' then media_id else background_media_id end,
        background_style = case when p_field = 'backgroundStyle' then value_text else background_style end,
        updated_by = actor_id
    where id = p_entity_id and is_enabled and updated_at = p_expected_updated_at
      and not (settings ? 'systemKey') and not (settings ? 'coreSectionKey')
    returning updated_at into updated_at_value;
    audit_action := 'homepage.block.visual_field_updated';
    publication_type := 'homepage';
  else
    raise exception 'visual_edit_entity_forbidden' using errcode = '22023';
  end if;

  if updated_at_value is null then
    raise exception 'visual_edit_conflict' using errcode = '40001';
  end if;
  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id, audit_action, publication_type, p_entity_id::text,
    jsonb_build_object('field', p_field, 'editor', 'visual-v2')
  );
  return jsonb_build_object('updatedAt', updated_at_value);
end;
$$;

create or replace function public.save_homepage_visual_settings_v2(
  p_entity_id uuid,
  p_settings jsonb,
  p_reset boolean,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  updated_at_value timestamptz;
  visual_keys text[] := array[
    'imageFit', 'imagePosition', 'imageZoom', 'imageBrightness',
    'imageContrast', 'imageSaturation', 'imageBlur', 'imageOverlay',
    'titleFontSize', 'titleAlign', 'titleWeight', 'titleLineHeight',
    'bodyFontSize', 'bodyAlign', 'bodyWeight', 'bodyLineHeight'
  ];
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'visual_edit_forbidden' using errcode = '42501';
  end if;
  if p_entity_id is null or p_expected_updated_at is null
    or not public.is_valid_homepage_visual_settings(p_settings) then
    raise exception 'visual_edit_invalid' using errcode = '22023';
  end if;
  update public.homepage_blocks
  set settings = case when coalesce(p_reset, false)
        then settings - visual_keys
        else (settings - visual_keys) || p_settings end,
      updated_by = actor_id
  where id = p_entity_id and is_enabled and updated_at = p_expected_updated_at
    and not (settings ? 'systemKey') and not (settings ? 'coreSectionKey')
  returning updated_at into updated_at_value;
  if updated_at_value is null then
    raise exception 'visual_edit_conflict' using errcode = '40001';
  end if;
  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    case when coalesce(p_reset, false)
      then 'homepage.block.visual_settings_reset'
      else 'homepage.block.visual_settings_updated' end,
    'homepage', p_entity_id::text,
    jsonb_build_object('fields', visual_keys, 'editor', 'visual-v2')
  );
  return jsonb_build_object('updatedAt', updated_at_value);
end;
$$;

revoke all on function public.is_valid_homepage_visual_settings(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.save_visual_content_field_v2(
  text, uuid, text, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.save_homepage_visual_settings_v2(
  uuid, jsonb, boolean, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.save_visual_content_field_v2(
  text, uuid, text, jsonb, timestamptz
) to authenticated;
grant execute on function public.save_homepage_visual_settings_v2(
  uuid, jsonb, boolean, timestamptz
) to authenticated;
