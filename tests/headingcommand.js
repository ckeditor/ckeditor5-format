/**
 * @license Copyright (c) 2003-2017, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import ModelTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/modeltesteditor';
import ParagraphCommand from '@ckeditor/ckeditor5-paragraph/src/paragraphcommand';
import HeadingCommand from '../src/headingcommand';
import Range from '@ckeditor/ckeditor5-engine/src/model/range';
import { setData, getData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

const options = [
	{ modelElement: 'heading1', viewElement: 'h2', title: 'H2' },
	{ modelElement: 'heading2', viewElement: 'h3', title: 'H3' },
	{ modelElement: 'heading3', viewElement: 'h4', title: 'H4' }
];

describe( 'HeadingCommand', () => {
	let editor, document, commands, root, schema;

	beforeEach( () => {
		return ModelTestEditor.create().then( newEditor => {
			editor = newEditor;
			document = editor.document;
			commands = {};
			schema = document.schema;

			editor.commands.set( 'paragraph', new ParagraphCommand( editor ) );
			schema.registerItem( 'paragraph', '$block' );

			for ( let option of options ) {
				commands[ option.modelElement ] = new HeadingCommand( editor, option );
				schema.registerItem( option.modelElement, '$block' );
			}

			schema.registerItem( 'notBlock' );
			schema.allow( { name: 'notBlock', inside: '$root' } );
			schema.allow( { name: '$text', inside: 'notBlock' } );

			schema.registerItem( 'object' );
			schema.allow( { name: 'object', inside: '$root' } );
			schema.allow( { name: '$text', inside: 'object' } );
			schema.objects.add( 'object' );

			root = document.getRoot();
		} );
	} );

	afterEach( () => {
		for ( let modelElement in commands ) {
			commands[ modelElement ].destroy();
		}
	} );

	describe( 'basic properties', () => {
		for ( let option of options ) {
			test( option );
		}

		function test( { modelElement, viewElement, title } ) {
			it( `are set for option.modelElement = ${ modelElement }`, () => {
				expect( commands[ modelElement ].modelElement ).to.equal( modelElement );
				expect( commands[ modelElement ].viewElement ).to.equal( viewElement );
				expect( commands[ modelElement ].title ).to.equal( title );
			} );
		}
	} );

	describe( 'value', () => {
		for ( let option of options ) {
			test( option );
		}

		function test( { modelElement } ) {
			it( `equals ${ modelElement } when collapsed selection is placed inside ${ modelElement } element`, () => {
				setData( document, `<${ modelElement }>foobar</${ modelElement }>` );
				const element = root.getChild( 0 );
				document.selection.addRange( Range.createFromParentsAndOffsets( element, 3, element, 3 ) );

				expect( commands[ modelElement ].value ).to.be.true;
			} );

			it( `equals false if moved from ${ modelElement } to non-block element`, () => {
				setData( document, `<${ modelElement }>[foo]</${ modelElement }><notBlock>foo</notBlock>` );
				const element = document.getRoot().getChild( 1 );

				expect( commands[ modelElement ].value ).to.be.true;

				document.enqueueChanges( () => {
					document.selection.setRanges( [ Range.createIn( element ) ] );
				} );

				expect( commands[ modelElement ].value ).to.be.false;
			} );
		}
	} );

	describe( '_doExecute', () => {
		it( 'should update value after execution', () => {
			const command = commands.heading1;

			setData( document, '<paragraph>[]</paragraph>' );
			command._doExecute();

			expect( getData( document ) ).to.equal( '<heading1>[]</heading1>' );
			expect( command.value ).to.be.true;
		} );

		describe( 'custom options', () => {
			it( 'should use provided batch', () => {
				const batch = editor.document.batch();
				const command = commands.heading1;

				setData( document, '<paragraph>foo[]bar</paragraph>' );

				expect( batch.deltas.length ).to.equal( 0 );

				command._doExecute( { batch } );

				expect( batch.deltas.length ).to.be.above( 0 );
			} );

			it( 'should use provided batch (converting to default option)', () => {
				const batch = editor.document.batch();
				const command = commands.heading1;

				setData( document, '<heading1>foo[]bar</heading1>' );

				expect( batch.deltas.length ).to.equal( 0 );

				command._doExecute( { batch } );

				expect( batch.deltas.length ).to.be.above( 0 );
			} );
		} );

		describe( 'collapsed selection', () => {
			let convertTo = options[ options.length - 1 ];

			for ( let option of options ) {
				test( option, convertTo );
				convertTo = option;
			}

			it( 'converts to default option when executed with already applied option', () => {
				const command = commands.heading1;

				setData( document, '<heading1>foo[]bar</heading1>' );
				command._doExecute();

				expect( getData( document ) ).to.equal( '<paragraph>foo[]bar</paragraph>' );
			} );

			it( 'converts topmost blocks', () => {
				schema.registerItem( 'inlineImage', '$inline' );
				schema.allow( { name: '$text', inside: 'inlineImage' } );

				setData( document, '<paragraph><inlineImage>foo[]</inlineImage>bar</paragraph>' );
				commands.heading1._doExecute();

				expect( getData( document ) ).to.equal( '<heading1><inlineImage>foo[]</inlineImage>bar</heading1>' );
			} );

			function test( from, to ) {
				it( `converts ${ from.modelElement } to ${ to.modelElement } on collapsed selection`, () => {
					setData( document, `<${ from.modelElement }>foo[]bar</${ from.modelElement }>` );
					commands[ to.modelElement ]._doExecute();

					expect( getData( document ) ).to.equal( `<${ to.modelElement }>foo[]bar</${ to.modelElement }>` );
				} );
			}
		} );

		describe( 'non-collapsed selection', () => {
			let convertTo = options[ options.length - 1 ];

			for ( let option of options ) {
				test( option, convertTo );
				convertTo = option;
			}

			it( 'converts all elements where selection is applied', () => {
				setData( document, '<heading1>foo[</heading1><heading2>bar</heading2><heading3>]baz</heading3>' );
				commands.heading3._doExecute();

				expect( getData( document ) ).to.equal(
					'<heading3>foo[</heading3><heading3>bar</heading3><heading3>]baz</heading3>'
				);
			} );

			it( 'resets to default value all elements with same option', () => {
				setData( document, '<heading1>foo[</heading1><heading1>bar</heading1><heading2>baz</heading2>]' );
				commands.heading1._doExecute();

				expect( getData( document ) ).to.equal(
					'<paragraph>foo[</paragraph><paragraph>bar</paragraph><heading2>baz</heading2>]'
				);
			} );

			function test( { modelElement: fromElement }, { modelElement: toElement } ) {
				it( `converts ${ fromElement } to ${ toElement } on non-collapsed selection`, () => {
					setData(
						document,
						`<${ fromElement }>foo[bar</${ fromElement }><${ fromElement }>baz]qux</${ fromElement }>`
					);

					commands[ toElement ]._doExecute();

					expect( getData( document ) ).to.equal(
						`<${ toElement }>foo[bar</${ toElement }><${ toElement }>baz]qux</${ toElement }>`
					);
				} );
			}
		} );
	} );

	describe( 'isEnabled', () => {
		for ( let option of options ) {
			test( option.modelElement );
		}

		function test( modelElement ) {
			let command;

			beforeEach( () => {
				command = commands[ modelElement ];
			} );

			describe( `${ modelElement } command`, () => {
				it( 'should be enabled when inside another block', () => {
					setData( document, '<paragraph>f{}oo</paragraph>' );

					expect( command.isEnabled ).to.be.true;
				} );

				it( 'should be disabled if inside non-block', () => {
					setData( document, '<notBlock>f{}oo</notBlock>' );

					expect( command.isEnabled ).to.be.false;
				} );

				it( 'should be disabled if inside object', () => {
					setData( document, '<object>f{}oo</object>' );

					expect( command.isEnabled ).to.be.false;
				} );

				it( 'should be disabled if selection is placed on object', () => {
					setData( document, '[<object>foo</object>]' );

					expect( command.isEnabled ).to.be.false;
				} );
			} );
		}
	} );
} );
