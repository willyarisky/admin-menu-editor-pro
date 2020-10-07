<?php

abstract class ameBaseTweak {
	protected $id;
	protected $label;

	protected $parentId;
	protected $sectionId;

	/**
	 * @var ameUserInputDefinition|null
	 */
	protected $userInput = null;

	/**
	 * @var string[]|null List of admin screen IDs that the tweak applies to.
	 */
	protected $screens = null;

	public function __construct($id, $label = null) {
		$this->id = $id;
		$this->label = ($label !== null) ? $label : $id;
	}

	/**
	 * @param string|number|null $userInputValue
	 * @return mixed
	 */
	abstract public function apply($userInputValue = null);

	public function getId() {
		return $this->id;
	}

	public function getLabel() {
		return $this->label;
	}

	public function getParentId() {
		return $this->parentId;
	}

	public function setParentId($id) {
		$this->parentId = $id;
		return $this;
	}

	public function setSectionId($id) {
		$this->sectionId = $id;
		return $this;
	}

	public function getSectionId() {
		return $this->sectionId;
	}

	public function hasScreenFilter() {
		return ($this->screens !== null);
	}

	public function isEnabledForCurrentScreen() {
		if ( !$this->hasScreenFilter() ) {
			return true;
		}
		if ( !function_exists('get_current_screen') ) {
			return false;
		}
		$screen = get_current_screen();
		if ( isset($screen, $screen->id) ) {
			return $this->isEnabledForScreen($screen->id);
		}
		return false;
	}

	public function isEnabledForScreen($screenId) {
		if ( $this->screens === null ) {
			return true;
		}
		return in_array($screenId, $this->screens);
	}

	public function setScreens($screens) {
		$this->screens = $screens;
	}

	public function supportsUserInput() {
		return ($this->userInput !== null);
	}

	public function getInputDefinitionData() {
		if ( $this->userInput !== null ) {
			return $this->userInput->toArray();
		}
		return array();
	}

	/**
	 * @param ameUserInputDefinition|null $input
	 */
	public function setInputDefinition($input) {
		$this->userInput = $input;
	}

	public function getContentPropertyName() {
		if ( isset($this->userInput->contentProperty) ) {
			return $this->userInput->contentProperty;
		}
		return null;
	}

	//todo: getEditableProperties(). Or maybe we don't need it at all? Just merge the settings.
}