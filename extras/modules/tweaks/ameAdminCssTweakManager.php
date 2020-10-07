<?php

class ameAdminCssTweakManager {
	private $isOutputHookRegistered = false;
	private $pendingCss = array();

	private $cachedUserInput = null;

	public function __construct() {
		add_action('admin-menu-editor-register_tweaks', array($this, 'registerDefaultTweak'), 10, 1);
	}

	public function enqueueCss($css = null) {
		if ( $css === null ) {
			return;
		}
		$this->pendingCss[] = $css;
		if ( !$this->isOutputHookRegistered ) {
			add_action('admin_print_scripts', array($this, 'outputCss'));
			$this->isOutputHookRegistered = true;
		}
	}

	public function outputCss() {
		if ( empty($this->pendingCss) ) {
			return;
		}
		echo '<!-- Admin Menu Editor: Admin CSS tweaks -->', "\n";
		echo '<style type="text/css" id="ame-admin-css-tweaks">', "\n";
		echo implode("\n", $this->pendingCss);
		echo "\n", '</style>', "\n";
	}

	/**
	 * Create a CSS tweak instance with the specified properties.
	 *
	 * @param array $properties
	 * @return ameDelegatedTweak
	 */
	public function createTweak($properties) {
		if ( $this->cachedUserInput === null ) {
			$cssInput = new ameTweakTextAreaInput();
			$cssInput->syntaxHighlighting = 'css';
			$cssInput->contentProperty = 'css';
			$this->cachedUserInput = $cssInput;
		}

		$cssTweak = new ameDelegatedTweak(
			$properties['id'],
			$properties['label'],
			array($this, 'enqueueCss')
		);
		$cssTweak->setInputDefinition($this->cachedUserInput);
		$cssTweak->setSectionId('admin-css');
		return $cssTweak;
	}

	/**
	 * @param ameTweakManager $tweakManager
	 */
	public function registerDefaultTweak($tweakManager) {
		$tweakManager->addSection('admin-css', 'Admin CSS', 20);

		$defaultTweak = $this->createTweak(array(
			'id'    => 'default-admin-css',
			'label' => 'Add custom admin CSS',
		));
		$tweakManager->addTweak($defaultTweak);
	}
}