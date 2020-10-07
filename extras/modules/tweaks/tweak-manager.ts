/// <reference path="../../../js/knockout.d.ts" />
/// <reference path="../../../js/jquery.d.ts" />
/// <reference path="../../../js/lodash-3.10.d.ts" />
/// <reference path="../../../modules/actor-selector/actor-selector.ts" />
/// <reference path="../../../js/jquery.biscuit.d.ts" />
/// <reference path="../../ko-dialog-bindings.ts" />

declare let ameTweakManager: AmeTweakManagerModule;
declare const wsTweakManagerData: AmeTweakManagerScriptData;

declare const wp: {
	codeEditor: {
		initialize: (textarea: string, options: object) => any;
	};
};

interface AmeTweakManagerScriptData {
	selectedActor: string;
	isProVersion: boolean;
	tweaks: AmeTweakProperties[];
	sections: AmeSectionProperties[];
	lastUserTweakSuffix: number;
	defaultCodeEditorSettings: Record<string, any>;
}

interface AmeSavedTweakProperties {
	id: string;
	enabledForActor?: AmeDictionary<boolean>;
	userInputValue?: AmeTweakInputValueType;
}

interface AmeTweakProperties extends AmeSavedTweakProperties {
	label: string;
	description?: string;
	parentId?: string;
	sectionId?: string;
	userInput?: AmeTweakInputProperties;

	isUserDefined?: boolean;
	typeId?: string;

	//User-defined tweaks can have additional arbitrary properties.
	[key: string]: any;
}

class AmeTweakItem {
	id: string;
	label: KnockoutObservable<string>;
	children: KnockoutObservableArray<AmeTweakItem>;

	isChecked: KnockoutComputed<boolean>;
	private enabledForActor: AmeObservableActorSettings;
	private module: AmeTweakManagerModule;

	isIndeterminate: KnockoutComputed<boolean>;

	userInput?: AmeTweakInput;

	public readonly isUserDefined: boolean;
	private readonly initialProperties: AmeSavedTweakProperties = null;

	private editableProperties: Record<string, KnockoutObservable<any>> = {};

	private section: AmeTweakSection = null;
	private parent: AmeTweakItem = null;

	constructor(properties: AmeTweakProperties, module: AmeTweakManagerModule) {
		this.isUserDefined = properties.isUserDefined ? properties.isUserDefined : false;
		if (this.isUserDefined) {
			this.initialProperties = properties;
		}

		this.id = properties.id;

		if (this.isUserDefined) {
			this.label = ko.observable(properties.label);
		} else {
			this.label = ko.pureComputed(function () {
				return properties.label;
			});
		}

		this.children = ko.observableArray([]);

		this.module = module;
		this.enabledForActor = new AmeObservableActorSettings(properties.enabledForActor || null);

		let _isIndeterminate = ko.observable<boolean>(false);
		this.isIndeterminate = ko.computed<boolean>(() => {
			if (module.selectedActor() !== null) {
				return false;
			}
			return _isIndeterminate();
		});

		this.isChecked = ko.computed<boolean>({
			read: () => {
				const selectedActor = this.module.selectedActor();

				if (selectedActor === null) {
					//All: Checked only if it's checked for all actors.
					const allActors = this.module.actorSelector.getVisibleActors();
					let isEnabledForAll = true, isEnabledForAny = false;
					for (let index = 0; index < allActors.length; index++) {
						if (this.enabledForActor.get(allActors[index].getId(), false)) {
							isEnabledForAny = true;
						} else {
							isEnabledForAll = false;
						}
					}

					_isIndeterminate(isEnabledForAny && !isEnabledForAll);

					return isEnabledForAll;
				}

				//Is there an explicit setting for this actor?
				let ownSetting = this.enabledForActor.get(selectedActor.getId(), null);
				if (ownSetting !== null) {
					return ownSetting;
				}

				if (selectedActor instanceof AmeUser) {
					//The "Super Admin" setting takes precedence over regular roles.
					if (selectedActor.isSuperAdmin) {
						let superAdminSetting = this.enabledForActor.get(AmeSuperAdmin.permanentActorId, null);
						if (superAdminSetting !== null) {
							return superAdminSetting;
						}
					}

					//Is it enabled for any of the user's roles?
					for (let i = 0; i < selectedActor.roles.length; i++) {
						let groupSetting = this.enabledForActor.get('role:' + selectedActor.roles[i], null);
						if (groupSetting === true) {
							return true;
						}
					}
				}

				//All tweaks are unchecked by default.
				return false;
			},
			write: (checked: boolean) => {
				const selectedActor = this.module.selectedActor();
				if (selectedActor === null) {
					//Enable/disable this tweak for all actors.
					if (checked === false) {
						//Since false is the default, this is the same as removing/resetting all values.
						this.enabledForActor.resetAll();
					} else {
						const allActors = this.module.actorSelector.getVisibleActors();
						for (let i = 0; i < allActors.length; i++) {
							this.enabledForActor.set(allActors[i].getId(), checked);
						}
					}
				} else {
					this.enabledForActor.set(selectedActor.getId(), checked);
				}

				//Apply the same setting to all children.
				const children = this.children();
				for (let i = 0; i < children.length; i++) {
					children[i].isChecked(checked);
				}
			}
		});

		if (properties.userInput) {
			this.userInput = AmeTweakInput.create(properties.userInput, module);
			const contentProperty = properties.userInput.contentProperty || 'userInputValue';
			const propertyObservable = this.getEditableProperty(contentProperty, properties);
			if (propertyObservable !== null) {
				this.userInput.setInputObservable(propertyObservable);
			}
		}
	}

	toJs(): AmeSavedTweakProperties {
		//Since all tweaks are disabled by default, having a tweak disabled for a role is the same
		//as not having a setting, so we can save some space by removing it. This does not always
		//apply to users/Super Admins because they can have precedence over roles.
		let temp = this.enabledForActor.getAll();
		let enabled: AmeDictionary<boolean> = {};
		let areAllFalse = true;
		for (let actorId in temp) {
			if (!temp.hasOwnProperty(actorId)) {
				continue;
			}

			areAllFalse = areAllFalse && (!temp[actorId]);
			if (!temp[actorId]) {
				const actor = AmeActors.getActor(actorId);
				if (actor instanceof AmeRole) {
					continue;
				}
			}
			enabled[actorId] = temp[actorId];
		}

		if (areAllFalse) {
			enabled = {};
		}

		let result: AmeSavedTweakProperties = {
			id: this.id,
			enabledForActor: enabled
		};

		if (this.userInput) {
			const inputValue = this.userInput.getInputValue();
			if ((inputValue !== '') && (inputValue !== null)) {
				result[this.userInput.contentProperty] = inputValue;
			}
		}

		if (!this.isUserDefined) {
			return result;
		} else {
			let props: AmeTweakProperties = result as AmeTweakProperties;
			props.isUserDefined = this.isUserDefined;
			props.label = this.label();
			props.sectionId = this.section ? this.section.id : null;
			props.parentId = this.parent ? this.parent.id : null;

			const _ = AmeTweakManagerModule._;
			let editableProps = {};
			_.forOwn(this.editableProperties, function (observable, key) {
				editableProps[key] = observable();
			});

			props = _.defaults(
				props,
				editableProps,
				_.omit(this.initialProperties, 'userInputValue', 'enabledForActor')
			);
			return props;
		}
	}

	setSection(section: AmeTweakSection) {
		this.section = section;
		return this;
	}

	setParent(tweak: AmeTweakItem) {
		this.parent = tweak;
		return this;
	}

	getSection(): AmeTweakSection {
		return this.section;
	}

	getParent(): AmeTweakItem {
		return this.parent;
	}

	addChild(tweak: AmeTweakItem) {
		this.children.push(tweak);
		tweak.setParent(this);
		return this;
	}

	removeChild(tweak: AmeTweakItem) {
		this.children.remove(tweak);
	}

	getEditableProperty(key: string, storedProperties?: AmeSavedTweakProperties): KnockoutObservable<any> {
		if (this.editableProperties.hasOwnProperty(key)) {
			return this.editableProperties[key];
		}
		if (!storedProperties && this.initialProperties) {
			storedProperties = this.initialProperties
		}
		if (storedProperties && storedProperties.hasOwnProperty(key)) {
			const observable = ko.observable(storedProperties[key]);
			this.editableProperties[key] = observable;
			return observable;
		}
		if (console && console.warn) {
			console.warn('Trying to retrieve and edit a non-existing property "%s"', key);
		}
		return ko.observable('');
	}

	getTypeId(): string | null {
		if (!this.isUserDefined || !this.initialProperties) {
			return null;
		}
		if ((this.initialProperties as AmeTweakProperties).typeId) {
			return (this.initialProperties as AmeTweakProperties).typeId;
		}
		return null;
	}
}

interface AmeSectionProperties {
	id: string;
	label: string;
	priority: number | null;
}

class AmeTweakSection {
	id: string;
	label: string;
	tweaks: KnockoutObservableArray<AmeTweakItem>;
	isOpen: KnockoutObservable<boolean>;

	footerTemplateName: string = null;

	constructor(properties: AmeSectionProperties) {
		this.id = properties.id;
		this.label = properties.label;
		this.isOpen = ko.observable<boolean>(true);
		this.tweaks = ko.observableArray([]);
	}

	addTweak(tweak: AmeTweakItem) {
		this.tweaks.push(tweak);
		tweak.setSection(this);
	}

	removeTweak(tweak: AmeTweakItem) {
		this.tweaks.remove(tweak);
	}

	hasContent() {
		return this.tweaks().length > 0;
	}

	toggle() {
		this.isOpen(!this.isOpen());
	}
}

type AmeTweakInputValueType = string | number;

interface AmeTweakInputProperties {
	inputType: string;
	contentProperty?: string;
	syntaxHighlighting?: string;
}

abstract class AmeTweakInput {
	// noinspection JSUnusedGlobalSymbols Used in Knockout templates.
	templateName: string;
	inputValue: KnockoutObservable<AmeTweakInputValueType>;
	contentProperty: AmeTweakInputProperties['contentProperty'];
	syntaxHighlightingOptions: object = null;

	setInputObservable(observable: KnockoutObservable<AmeTweakInputValueType>) {
		this.inputValue = observable;
	}

	getInputValue(): AmeTweakInputValueType {
		return this.inputValue();
	};

	setInputValue(value: AmeTweakInputValueType) {
		this.inputValue(value);
	};

	static create(properties: AmeTweakInputProperties, module?: AmeTweakManagerModule) {
		let input: AmeTweakInput;
		switch (properties.inputType) {
			case 'textarea':
				input = new AmeTweakTextAreaInput(properties, module);
				break;
			case 'text':
			default:
				throw {'message': 'Input type not implemented'};
		}
		if (properties.contentProperty) {
			input.contentProperty = properties.contentProperty;
		}
		return input;
	}
}

class AmeTweakTextAreaInput extends AmeTweakInput {
	templateName: string = 'ame-tweak-textarea-input-template';

	constructor(properties: AmeTweakInputProperties, module?: AmeTweakManagerModule) {
		super();
		this.inputValue = ko.observable('');

		if (properties.syntaxHighlighting && module) {
			this.syntaxHighlightingOptions = module.getCodeMirrorOptions(properties.syntaxHighlighting);
		}
	}
}

class AmeTweakManagerModule {
	static _ = wsAmeLodash;
	static readonly openSectionCookieName = 'ame_tmce_open_sections';

	readonly actorSelector: AmeActorSelector;
	selectedActorId: KnockoutComputed<string>;
	selectedActor: KnockoutComputed<IAmeActor>;

	private tweaksById: { [id: string]: AmeTweakItem } = {};
	private sectionsById: AmeDictionary<AmeTweakSection> = {};
	sections: AmeTweakSection[] = [];

	settingsData: KnockoutObservable<string>;
	isSaving: KnockoutObservable<boolean>;

	private readonly openSectionIds: KnockoutComputed<string[]>;

	readonly adminCssEditorDialog: AmeEditAdminCssDialog;
	private lastUserTweakSuffix: number = 0;

	public readonly cssHighlightingOptions: Record<string, any>;

	constructor(scriptData: AmeTweakManagerScriptData) {
		const _ = AmeTweakManagerModule._;

		this.actorSelector = new AmeActorSelector(AmeActors, scriptData.isProVersion);
		this.selectedActorId = this.actorSelector.createKnockoutObservable(ko);
		this.selectedActor = ko.computed<IAmeActor>(() => {
			const id = this.selectedActorId();
			if (id === null) {
				return null;
			}
			return AmeActors.getActor(id);
		});

		//Reselect the previously selected actor.
		this.selectedActorId(scriptData.selectedActor);

		//Set syntax highlighting options.
		this.cssHighlightingOptions = _.merge(
			{},
			scriptData.defaultCodeEditorSettings,
			{
				'codemirror': {
					'mode': 'css',
					'lint': true,
					'autoCloseBrackets': true,
					'matchBrackets': true
				}
			}
		);

		//Sort sections by priority, then by label.
		let sectionData = _.sortByAll(scriptData.sections, ['priority', 'label']);
		//Register sections.
		_.forEach(sectionData, (properties) => {
			let section = new AmeTweakSection(properties);
			this.sectionsById[section.id] = section;
			this.sections.push(section);
		});
		const firstSection = this.sections[0];

		_.forEach(scriptData.tweaks, (properties) => {
			const tweak = new AmeTweakItem(properties, this);
			this.tweaksById[tweak.id] = tweak;

			if (properties.parentId && this.tweaksById.hasOwnProperty(properties.parentId)) {
				this.tweaksById[properties.parentId].addChild(tweak);
			} else {
				let ownerSection = firstSection;
				if (properties.sectionId && this.sectionsById.hasOwnProperty(properties.sectionId)) {
					ownerSection = this.sectionsById[properties.sectionId];
				}
				ownerSection.addTweak(tweak);
			}
		});

		//Remove empty sections.
		this.sections = _.filter(this.sections, function (section) {
			return section.hasContent();
		});

		//Add the tweak creation button to the Admin CSS section.
		if (this.sectionsById.hasOwnProperty('admin-css')) {
			this.sectionsById['admin-css'].footerTemplateName = 'ame-admin-css-section-footer';
		}

		//By default, all sections except the first one are closed.
		//The user can open/close sections and we automatically remember their state.
		this.openSectionIds = ko.computed<string[]>({
			read: () => {
				let result = [];
				_.forEach(this.sections, section => {
					if (section.isOpen()) {
						result.push(section.id);
					}
				});
				return result;
			},
			write: (sectionIds: string[]) => {
				const openSections = _.indexBy(sectionIds);
				_.forEach(this.sections, section => {
					section.isOpen(openSections.hasOwnProperty(section.id));
				});
			}
		});
		this.openSectionIds.extend({rateLimit: {timeout: 1000, method: 'notifyWhenChangesStop'}});

		let initialState: string[] = null;
		let cookieValue = jQuery.cookie(AmeTweakManagerModule.openSectionCookieName);
		if ((typeof cookieValue === 'string') && JSON && JSON.parse) {
			let storedState = JSON.parse(cookieValue);
			if (_.isArray<string>(storedState)) {
				initialState = _.intersection(_.keys(this.sectionsById), storedState);
			}
		}

		if (initialState !== null) {
			this.openSectionIds(initialState);
		} else {
			this.openSectionIds([_.first(this.sections).id]);
		}

		this.openSectionIds.subscribe((sectionIds) => {
			jQuery.cookie(AmeTweakManagerModule.openSectionCookieName, ko.toJSON(sectionIds), {expires: 90});
		});

		if (scriptData.lastUserTweakSuffix) {
			this.lastUserTweakSuffix = scriptData.lastUserTweakSuffix;
		}

		this.adminCssEditorDialog = new AmeEditAdminCssDialog(this);

		this.settingsData = ko.observable<string>('');
		this.isSaving = ko.observable<boolean>(false);
	}

	saveChanges() {
		this.isSaving(true);
		const _ = wsAmeLodash;

		let data = {
			'tweaks': _.indexBy(_.invoke(this.tweaksById, 'toJs'), 'id'),
			'lastUserTweakSuffix': this.lastUserTweakSuffix
		};
		this.settingsData(ko.toJSON(data));
		return true;
	}

	addAdminCssTweak(label: string, css: string) {
		this.lastUserTweakSuffix++;

		let slug = this.slugify(label);
		if (slug !== '') {
			slug = '-' + slug;
		}

		let props: AmeTweakProperties = {
			label: label,
			id: 'utw-' + this.lastUserTweakSuffix + slug,
			isUserDefined: true,
			sectionId: 'admin-css',
			typeId: 'admin-css'
		};
		props['css'] = css;

		props.userInput = {
			contentProperty: 'css',
			syntaxHighlighting: 'css',
			inputType: 'textarea'
		};

		const newTweak = new AmeTweakItem(props, this);
		this.tweaksById[newTweak.id] = newTweak;
		this.sectionsById['admin-css'].addTweak(newTweak)
	}

	slugify(input: string): string {
		const _ = AmeTweakManagerModule._;
		let output = _.deburr(input);
		output = output.replace(/[^a-zA-Z0-9]/, '');
		return _.kebabCase(output);
	}

	launchTweakEditor(tweak: AmeTweakItem) {
		// noinspection JSRedundantSwitchStatement
		switch (tweak.getTypeId()) {
			case 'admin-css':
				this.adminCssEditorDialog.selectedTweak = tweak;
				this.adminCssEditorDialog.open();
				break;
			default:
				alert('Error: Editor not implemented! This is probably a bug.');
		}
	}

	confirmDeleteTweak(tweak: AmeTweakItem) {
		if (!tweak.isUserDefined || !confirm('Delete this tweak?')) {
			return;
		}
		this.deleteTweak(tweak);
	}

	protected deleteTweak(tweak: AmeTweakItem) {
		const section = tweak.getSection();
		if (section) {
			section.removeTweak(tweak);
		}
		const parent = tweak.getParent();
		if (parent) {
			parent.removeChild(tweak);
		}
		delete this.tweaksById[tweak.id];
	}

	getCodeMirrorOptions(mode: string) {
		if (mode === 'css') {
			return this.cssHighlightingOptions;
		}
		return null;
	}
}

class AmeEditAdminCssDialog implements AmeKnockoutDialog {
	jQueryWidget: JQuery;
	isOpen: KnockoutObservable<boolean>;
	autoCancelButton: boolean = false;

	options: AmeDictionary<any> = {
		minWidth: 400
	};

	isAddButtonEnabled: KnockoutComputed<boolean>;
	tweakLabel: KnockoutObservable<string>;
	cssCode: KnockoutObservable<string>;
	confirmButtonText: KnockoutObservable<string>;
	title: KnockoutObservable<string>;

	selectedTweak: AmeTweakItem = null;

	private manager: AmeTweakManagerModule;

	constructor(manager: AmeTweakManagerModule) {
		const _ = AmeTweakManagerModule._;
		this.manager = manager;

		this.tweakLabel = ko.observable('');
		this.cssCode = ko.observable('');
		this.confirmButtonText = ko.observable('Add Snippet');
		this.title = ko.observable(null);

		this.isAddButtonEnabled = ko.computed(() => {
			return !((_.trim(this.tweakLabel()) === '') || (_.trim(this.cssCode()) === ''));
		});
		this.isOpen = ko.observable(false);
	}

	onOpen(event, ui) {
		if (this.selectedTweak) {
			this.tweakLabel(this.selectedTweak.label());
			this.title('Edit admin CSS snippet');
			this.confirmButtonText('Save Changes');

			const cssProperty = this.selectedTweak.getEditableProperty('css');
			this.cssCode(cssProperty ? cssProperty() : '');
		} else {
			this.tweakLabel('');
			this.cssCode('');
			this.title('Add admin CSS snippet');
			this.confirmButtonText('Add Snippet');
		}
	}

	onConfirm() {
		if (this.selectedTweak) {
			//Update the existing tweak.
			this.selectedTweak.label(this.tweakLabel());
			this.selectedTweak.getEditableProperty('css')(this.cssCode());
		} else {
			//Create a new tweak.
			this.manager.addAdminCssTweak(
				this.tweakLabel(),
				this.cssCode()
			);
		}
		this.close();
	}

	onClose() {
		this.selectedTweak = null;
	}

	close() {
		this.isOpen(false);
	}

	open() {
		this.isOpen(true);
	}
}

//A one-way binding for indeterminate checkbox states.
ko.bindingHandlers['indeterminate'] = {
	update: function (element, valueAccessor) {
		element.indeterminate = !!(ko.unwrap(valueAccessor()));
	}
};

ko.bindingHandlers.ameCodeMirror = {
	init: function (element, valueAccessor, allBindings) {
		if (!wp.hasOwnProperty('codeEditor') || !wp.codeEditor.initialize) {
			return;
		}
		let parameters = ko.unwrap(valueAccessor());
		if (!parameters) {
			return;
		}

		let options;
		let refreshTrigger: KnockoutObservable<any>;
		if (parameters.options) {
			options = parameters.options;
			if (parameters.refreshTrigger) {
				refreshTrigger = parameters.refreshTrigger;
			}
		} else {
			options = parameters;
		}

		let result = wp.codeEditor.initialize(element, options);
		const cm = result.codemirror;

		//Synchronise the editor contents with the observable passed to the "value" binding.
		let valueObservable: KnockoutObservable<any> = allBindings.get('value');
		if (!ko.isObservable(valueObservable)) {
			valueObservable = null;
		}

		let subscription = null;
		let changeHandler = null;
		if (valueObservable !== null) {
			//Update the observable when the contents of the editor change.
			let ignoreNextUpdate = false;
			changeHandler = function () {
				//This will trigger our observable subscription (see below).
				//We need to ignore that trigger to avoid recursive or duplicated updates.
				ignoreNextUpdate = true;
				valueObservable(cm.doc.getValue());
			};
			cm.on('changes', changeHandler);

			//Update the editor when the observable changes.
			subscription = valueObservable.subscribe(function (newValue) {
				if (ignoreNextUpdate) {
					ignoreNextUpdate = false;
					return;
				}
				cm.doc.setValue(newValue);
				ignoreNextUpdate = false;
			});
		}

		//Refresh the size of the editor element when an observable changes value.
		let refreshSubscription: KnockoutSubscription = null;
		if (refreshTrigger) {
			refreshSubscription  = refreshTrigger.subscribe(function() {
				cm.refresh();
			});
		}

		ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
			//Remove subscriptions and event handlers.
			if (subscription) {
				subscription.dispose();
			}
			if (refreshSubscription) {
				refreshSubscription.dispose();
			}
			if (changeHandler) {
				cm.off('changes', changeHandler);
			}

			//Destroy the CodeMirror instance.
			jQuery(cm.getWrapperElement()).remove();
		});
	}
};

jQuery(function () {
	ameTweakManager = new AmeTweakManagerModule(wsTweakManagerData);
	ko.applyBindings(ameTweakManager, document.getElementById('ame-tweak-manager'));
});