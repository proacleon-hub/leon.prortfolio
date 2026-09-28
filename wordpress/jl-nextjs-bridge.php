<?php
/**
 * Plugin Name: JL Next.js bridge
 * Description: Tells the Next.js site (Vercel) to refresh the moment anything is saved in WordPress, and keeps the CMS address out of Google once WordPress moves to cms.junayedleon.tech. Safe to delete: the Next.js site then refreshes every 5 minutes on its own.
 * Version: 1.1.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * After the move, WordPress is also reached at cms.junayedleon.tech (that is
 * where the Next.js site reads it from, and where you log in). On that address
 * WordPress uses it as its own address instead of redirecting to the public
 * domain. Requests on junayedleon.tech are untouched, so nothing changes until
 * the domain is switched, and switching back needs no WordPress change.
 */
if (isset($_SERVER['HTTP_HOST']) && strtolower($_SERVER['HTTP_HOST']) === 'cms.junayedleon.tech') {
    $jl_bridge_cms_url = function () {
        return 'https://cms.junayedleon.tech';
    };
    add_filter('option_home', $jl_bridge_cms_url, 99);
    add_filter('option_siteurl', $jl_bridge_cms_url, 99);
}

/** Public Next.js addresses to notify. The live domain is only added once WordPress has moved off it. */
function jl_bridge_frontends() {
    $urls = array('https://leon-prortfolio.vercel.app');
    $wp_host = wp_parse_url(home_url(), PHP_URL_HOST);
    if ($wp_host !== 'junayedleon.tech' && $wp_host !== 'www.junayedleon.tech') {
        $urls[] = 'https://junayedleon.tech';
    }
    return $urls;
}

/** Remember that something changed; the ping is sent once, at the end of the request. */
function jl_bridge_mark_changed() {
    $GLOBALS['jl_bridge_changed'] = true;
}

add_action('save_post', function ($post_id) {
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return;
    }
    jl_bridge_mark_changed();
});
foreach (array(
    'deleted_post', 'trashed_post', 'untrashed_post',
    'created_term', 'edited_term', 'delete_term',
    'wp_update_nav_menu', 'customize_save_after',
    'elementor/document/after_save', 'elementor/core/files/clear_cache',
    'activated_plugin', 'deactivated_plugin', 'switch_theme',
) as $hook) {
    add_action($hook, 'jl_bridge_mark_changed');
}
add_action('updated_option', function ($option) {
    if (preg_match('/^(wpseo|elementor_|blogname$|blogdescription$|site_icon$|sticky_posts$|page_on_front$)/', $option)) {
        jl_bridge_mark_changed();
    }
});

add_action('shutdown', function () {
    if (empty($GLOBALS['jl_bridge_changed'])) {
        return;
    }
    update_option('jl_last_change', time(), false);
    foreach (jl_bridge_frontends() as $url) {
        wp_remote_post($url . '/api/revalidate/', array('blocking' => false, 'timeout' => 1));
    }
});

/** The Next.js site asks this before refreshing, so the refresh address can't be abused. */
add_action('rest_api_init', function () {
    register_rest_route('jl/v1', '/last-change', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => function () {
            return new WP_REST_Response(array('t' => (int) get_option('jl_last_change', 0)), 200);
        },
    ));
});

/** After the move, WordPress lives on cms.junayedleon.tech: keep that address out of search results. */
add_action('send_headers', function () {
    $host = isset($_SERVER['HTTP_HOST']) ? strtolower($_SERVER['HTTP_HOST']) : '';
    if (strpos($host, 'cms.') === 0) {
        header('X-Robots-Tag: noindex, nofollow', true);
    }
});
